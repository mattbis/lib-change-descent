/* lib/local/lib-change-descent-custom_eslint.mjs */

/**
 * Custom rule to enforce:
 * 1. No space before assignment/infix operators (e.g., var x= thing)
 * 2. Exactly one space after assignment/infix operators (unless at end of line)
 */
const noSpaceBeforeAssignmentRule = {
    meta: {
        type: "layout",
        fixable: "whitespace",
        messages: {
            noSpaceBefore: "Expected no space before '{{operator}}'.",
            spaceAfter: "Expected space after '{{operator}}'."
        }
    },
    create(context) {
        const sourceCode= context.sourceCode
        function check(node, left, operator = "=") {
            const token= sourceCode.getTokenAfter(left, (t) => t.value === operator)
            if (!token) return
            
            const prevToken= sourceCode.getTokenBefore(token)
            const nextToken = sourceCode.getTokenAfter(token)
            
            // Check before: identifier=
            const textBefore= sourceCode.text.slice(prevToken.range[1], token.range[0])
            if (textBefore.length > 0) {
                context.report({
                    node: token,
                    data: { operator },
                    messageId: "noSpaceBefore",
                    fix(fixer) {
                        return fixer.removeRange([prevToken.range[1], token.range[0]])
                    }
                })
            }
            
            // Check after: = value
            if (nextToken) {
                const textAfter= sourceCode.text.slice(token.range[1], nextToken.range[0])
                if (!textAfter.includes("\n") && textAfter !== " ") {
                    context.report({
                        node: token,
                        data: { operator },
                        messageId: "spaceAfter",
                        fix(fixer) {
                            return fixer.replaceTextRange([token.range[1], nextToken.range[0]], " ")
                        }
                    })
                }
            }
        }
        return {
            VariableDeclarator(node) {
                if (node.init) check(node, node.id)
            },
            AssignmentExpression(node) {
                check(node, node.left, node.operator)
            }
        }
    }
}

export default [
    {
        files: ["**/*.mjs"],
        plugins: {
            "local": {
                rules: {
                    "no-space-before-assignment": noSpaceBeforeAssignmentRule
                }
            }
        },
        rules: {
            "indent": ["error", 4],
            "semi": ["error", "never"],
            "camelcase": "off",
            "no-multi-spaces": "error",
            "local/no-space-before-assignment": "error"
        }
    }
]
