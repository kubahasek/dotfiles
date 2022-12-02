require("mason").setup()
require("mason-tool-installer").setup {
  ensure_installed = {
    "csharp-language-server",
    "csharpier",
    "eslint_d",
    "lua-language-server",
    "phpcbf",
    "phpcs",
    "psalm",
    "tailwindcss-language-server",
    "typescript-language-server",
    "prettierd",
    "deno",
  }
}
require("mason-lspconfig").setup()
require("mason-lspconfig").setup_handlers {
  -- The first entry (without a key) will be the default handler
  -- and will be called for each installed server that doesn't have
  -- a dedicated handler.
  function(server_name) -- default handler (optional)
    require("lspconfig")[server_name].setup {}
  end,
}
