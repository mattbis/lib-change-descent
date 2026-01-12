/* define implentation of sqllite driver */
export const sqlite_driver= {
    connect: () => {
        return true
    },
    disconnect: () => {
        return true
    },
    prepare: (sql) => {
        return true
    },
    run: () => {
        return true
    },
    get: () => {
        return true
    },
    all: () => {
        return true
    }
}