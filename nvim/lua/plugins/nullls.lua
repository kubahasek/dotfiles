require("null-ls").setup({
    sources = {
        require("null-ls").builtins.formatting.stylua,
        require("null-ls").builtins.completion.spell,
        require("null-ls").builtins.formatting.prettierd,
        require("null-ls").builtins.formatting.phpcbf,
        require("null-ls").builtins.diagnostics.psalm,
        require("null-ls").builtins.formatting.csharpier,
    },
    on_attach = function(client, bufnr)
        if client.supports_method("textDocument/formatting") then
            vim.api.nvim_clear_autocmds({ group = augroup, buffer = bufnr })
            vim.api.nvim_create_autocmd("BufWritePre", {
                group = augroup,
                buffer = bufnr,
                callback = function()
                    -- on 0.8, you should use vim.lsp.buf.format({ bufnr = bufnr }) instead
                    vim.lsp.buf.format({ bufnr = bufnr})
                end,
            })
        end
    end,
})
local lsp_formatting = function(bufnr)
    vim.lsp.buf.format({
        filter = function(client)
            -- apply whatever logic you want (in this example, we'll only use null-ls)
            return client.name == "null-ls"
        end,
        bufnr = bufnr,
    })
end
local augroup = vim.api.nvim_create_augroup("LspFormatting", {})
