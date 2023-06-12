require("mason").setup()
require("mason-tool-installer").setup {
    ensure_installed = {
        "eslint_d",
        "phpcbf",
        "prettierd",
    }
}
