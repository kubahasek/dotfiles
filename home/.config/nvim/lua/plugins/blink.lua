return {
  {
    "saghen/blink.cmp",
    opts = {
      -- Keep completions out of prompts, file pickers, trees, text buffers, etc.
      enabled = function()
        if vim.api.nvim_get_mode().mode == "c" then
          return false
        end

        local disabled_buftypes = { "prompt", "nofile", "terminal" }
        if vim.tbl_contains(disabled_buftypes, vim.bo.buftype) then
          return false
        end

        local disabled_filetypes = {
          "DressingInput",
          "TelescopePrompt",
          "Trouble",
          "gitcommit",
          "help",
          "lazy",
          "man",
          "markdown",
          "mason",
          "neo-tree",
          "noice",
          "notify",
          "qf",
          "snacks_input",
          "snacks_picker_input",
          "text",
        }

        return not vim.tbl_contains(disabled_filetypes, vim.bo.filetype)
      end,

      -- Fully disable blink's command-line completion mode.
      cmdline = { enabled = false },

      completion = {
        menu = {
          -- Keep insert-mode autocomplete, but only when `enabled()` above allows it.
          auto_show = true,
        },
      },

      sources = {
        default = { "lsp", "path", "snippets", "buffer" },
      },
    },
  },
}
