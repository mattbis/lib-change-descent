/**
 * Canonical OS command & subprocess executor (`libcd_os_executor.mjs`).
 * 
 * inspired by `execa` but strictly 100% zero-dependency (`1p/2p` discipline) tailored for `lib-change-descent`.
 * provides standardized, rich execution results (`stdout`, `stderr`, `exitCode`, `failed`, `timedOut`, `duration_ms`),
 * timeout tracking, AbortSignal cancellation, and clean `reject: false` status inspection.
 * 
 * CRITICAL: all OS executions are automatically recorded in the immutable manifest log (`IMUT_LOG`),
 * ensuring complete auditability across resident loops, volume discoveries, and Windows WFP rule modifications.
 */

// 1p
import { spawn, spawnSync } from 'node:child_process'
import process from 'node:process'

// 2p
import { arg_get_opt } from '../arg/libcd_arg.mjs'
import { post } from '../internal/imut_log/libcd_imut_log.mjs'
import { make_entry } from '../internal/imut_log/libcd_imut_log_entry.mjs'

/**
 * parses a command string into `{ command, args }` respecting single and double quotes.
 * if `args` array is explicitly passed alongside `file`, returns immediately.
 */
export function os_exec_parse_cmd(file_or_cmd, args= null) {
    if (Array.isArray(args)) {
        return { command: file_or_cmd, args: args.slice() }
    }
    if (typeof file_or_cmd !== 'string') {
        return { command: '', args: [] }
    }

    var tokens= []
    var current= ''
    var in_single= false
    var in_double= false
    var i= 0
    while (i < file_or_cmd.length) {
        var ch= file_or_cmd[i]
        if (ch === "'" && !in_double) {
            in_single= !in_single
        } else if (ch === '"' && !in_single) {
            in_double= !in_double
        } else if (ch === ' ' && !in_single && !in_double) {
            if (current.length > 0) {
                tokens.push(current)
                current= ''
            }
        } else {
            current= current + ch
        }
        i= i + 1
    }
    if (current.length > 0) {
        tokens.push(current)
    }

    if (tokens.length === 0) return { command: '', args: [] }
    return { command: tokens[0], args: tokens.slice(1) }
}

/**
 * strips trailing newlines (`\r\n` or `\n`) from output strings if `stripNewlines` is true.
 */
function format_output(val, strip= true) {
    if (val === null || val === undefined) return ''
    var str= typeof val === 'string' ? val : val.toString('utf8')
    if (!strip) return str
    while (str.length > 0 && (str.endsWith('\n') || str.endsWith('\r'))) {
        str= str.slice(0, str.length - 1)
    }
    return str
}

/**
 * formats an `execa`-like result dictionary.
 */
function make_result(command_str, exit_code, stdout, stderr, duration_ms, timed_out= false, error_obj= null) {
    var failed= exit_code !== 0 || timed_out || error_obj !== null
    return {
        command: command_str,
        exitCode: exit_code !== null ? exit_code : (failed ? 1 : 0),
        stdout: stdout,
        stderr: stderr,
        failed: failed,
        timedOut: timed_out,
        duration_ms: duration_ms,
        error: error_obj
    }
}

/**
 * synchronous OS execution (`execa.sync`-like).
 * automatically records `OS_CALL:OS_EXECUTOR_RUN` and `OS_CALL:OS_EXECUTOR_DONE` in `IMUT_LOG`.
 */
export function os_exec_sync(file_or_cmd, args= null, options= {}) {
    if (args && !Array.isArray(args) && typeof args === 'object') {
        options= args
        args= null
    }

    var parsed= os_exec_parse_cmd(file_or_cmd, args)
    var cmd_str= parsed.command + (parsed.args.length > 0 ? ' ' + parsed.args.join(' ') : '')
    var start_ts= Date.now()

    post(make_entry('OS_CALL', 'OS_EXECUTOR_RUN_SYNC', { command: parsed.command, args: parsed.args }))

    var timeout= arg_get_opt(options, 'timeout', 0)
    var input= arg_get_opt(options, 'input', null)
    var strip= arg_get_opt(options, 'stripNewlines', true)
    var reject= arg_get_opt(options, 'reject', true)
    var cwd= arg_get_opt(options, 'cwd', process.cwd())
    var env= arg_get_opt(options, 'env', process.env)

    var spawn_opts= {
        cwd: cwd,
        env: env,
        stdio: input !== null ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        windowsHide: arg_get_opt(options, 'windowsHide', true)
    }
    if (input !== null) {
        spawn_opts.input= input
    }
    if (timeout > 0) {
        spawn_opts.timeout= timeout
    }

    var res
    try {
        res= spawnSync(parsed.command, parsed.args, spawn_opts)
    } catch (err) {
        var duration_ms= Date.now() - start_ts
        var err_res= make_result(cmd_str, 1, '', err.message || '', duration_ms, false, err)
        post(make_entry('OS_CALL', 'OS_EXECUTOR_ERROR_SYNC', { command: cmd_str, duration_ms: duration_ms, error: err.message }))
        if (reject) {
            err.command= cmd_str
            err.exitCode= 1
            err.result= err_res
            throw err
        }
        return err_res
    }

    var duration_ms= Date.now() - start_ts
    var stdout_str= format_output(res.stdout, strip)
    var stderr_str= format_output(res.stderr, strip)
    var timed_out= res.error && res.error.code === 'ETIMEDOUT'
    var exit_code= res.status !== null ? res.status : (res.signal ? 1 : 0)

    var result= make_result(cmd_str, exit_code, stdout_str, stderr_str, duration_ms, timed_out, res.error || null)
    post(make_entry('OS_CALL', 'OS_EXECUTOR_DONE_SYNC', { command: cmd_str, exitCode: exit_code, duration_ms: duration_ms, failed: result.failed }))

    if (reject && result.failed) {
        var err_msg= timed_out
            ? '[OS_EXECUTOR] Command timed out after ' + timeout + 'ms: ' + cmd_str
            : '[OS_EXECUTOR] Command failed with exit code ' + exit_code + ': ' + cmd_str
        if (stderr_str) err_msg= err_msg + '\n' + stderr_str
        var exc= new Error(err_msg)
        exc.command= cmd_str
        exc.exitCode= exit_code
        exc.stdout= stdout_str
        exc.stderr= stderr_str
        exc.timedOut= timed_out
        exc.result= result
        throw exc
    }

    return result
}

/**
 * asynchronous OS execution (`execa`-like Promise).
 * supports `timeout`, `signal` (`AbortSignal`), `reject: false`, and `input` piping.
 */
export function os_exec(file_or_cmd, args= null, options= {}) {
    if (args && !Array.isArray(args) && typeof args === 'object') {
        options= args
        args= null
    }

    var parsed= os_exec_parse_cmd(file_or_cmd, args)
    var cmd_str= parsed.command + (parsed.args.length > 0 ? ' ' + parsed.args.join(' ') : '')
    var start_ts= Date.now()

    post(make_entry('OS_CALL', 'OS_EXECUTOR_RUN_ASYNC', { command: parsed.command, args: parsed.args }))

    var timeout= arg_get_opt(options, 'timeout', 0)
    var input= arg_get_opt(options, 'input', null)
    var strip= arg_get_opt(options, 'stripNewlines', true)
    var reject= arg_get_opt(options, 'reject', true)
    var signal= arg_get_opt(options, 'signal', null)
    var cwd= arg_get_opt(options, 'cwd', process.cwd())
    var env= arg_get_opt(options, 'env', process.env)

    return new Promise(function(resolve_promise, reject_promise) {
        var spawn_opts= {
            cwd: cwd,
            env: env,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: arg_get_opt(options, 'windowsHide', true)
        }
        if (signal) {
            spawn_opts.signal= signal
        }

        var child
        try {
            child= spawn(parsed.command, parsed.args, spawn_opts)
        } catch (err) {
            var dur= Date.now() - start_ts
            var err_res= make_result(cmd_str, 1, '', err.message || '', dur, false, err)
            post(make_entry('OS_CALL', 'OS_EXECUTOR_ERROR_ASYNC', { command: cmd_str, duration_ms: dur, error: err.message }))
            if (reject) {
                err.command= cmd_str
                err.result= err_res
                return reject_promise(err)
            }
            return resolve_promise(err_res)
        }

        var stdout_chunks= []
        var stderr_chunks= []
        var timed_out= false
        var timer= null

        if (timeout > 0) {
            timer= setTimeout(function() {
                timed_out= true
                try { child.kill('SIGTERM') } catch (e) {}
            }, timeout)
        }

        if (child.stdout) {
            child.stdout.on('data', function(chunk) { stdout_chunks.push(chunk) })
        }
        if (child.stderr) {
            child.stderr.on('data', function(chunk) { stderr_chunks.push(chunk) })
        }

        if (input !== null && child.stdin) {
            child.stdin.write(input)
            child.stdin.end()
        } else if (child.stdin) {
            child.stdin.end()
        }

        child.on('error', function(err) {
            if (timer) clearTimeout(timer)
            var dur= Date.now() - start_ts
            var stdout_str= format_output(Buffer.concat(stdout_chunks), strip)
            var stderr_str= format_output(Buffer.concat(stderr_chunks), strip)
            var err_res= make_result(cmd_str, 1, stdout_str, stderr_str || err.message, dur, timed_out, err)
            post(make_entry('OS_CALL', 'OS_EXECUTOR_ERROR_ASYNC', { command: cmd_str, duration_ms: dur, error: err.message }))
            if (reject) {
                err.command= cmd_str
                err.result= err_res
                return reject_promise(err)
            }
            resolve_promise(err_res)
        })

        child.on('close', function(code, signal_str) {
            if (timer) clearTimeout(timer)
            var dur= Date.now() - start_ts
            var stdout_str= format_output(Buffer.concat(stdout_chunks), strip)
            var stderr_str= format_output(Buffer.concat(stderr_chunks), strip)
            var exit_code= code !== null ? code : (timed_out || signal_str ? 1 : 0)

            var result= make_result(cmd_str, exit_code, stdout_str, stderr_str, dur, timed_out, null)
            post(make_entry('OS_CALL', 'OS_EXECUTOR_DONE_ASYNC', { command: cmd_str, exitCode: exit_code, duration_ms: dur, failed: result.failed }))

            if (reject && result.failed) {
                var err_msg= timed_out
                    ? '[OS_EXECUTOR] Command timed out after ' + timeout + 'ms: ' + cmd_str
                    : '[OS_EXECUTOR] Command failed with exit code ' + exit_code + ': ' + cmd_str
                if (stderr_str) err_msg= err_msg + '\n' + stderr_str
                var exc= new Error(err_msg)
                exc.command= cmd_str
                exc.exitCode= exit_code
                exc.stdout= stdout_str
                exc.stderr= stderr_str
                exc.timedOut= timed_out
                exc.result= result
                return reject_promise(exc)
            }

            resolve_promise(result)
        })
    })
}
