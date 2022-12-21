require("mason").setup()
require("mason-tool-installer").setup {
    ensure_installed = {
        "csharpier",
        "eslint_d",
        "phpcbf",
        "prettierd",
    }
}
