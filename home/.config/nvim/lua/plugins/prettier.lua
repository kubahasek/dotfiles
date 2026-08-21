-- Prettier formatter setup (using prettierd for speed)
-- prettierd is a daemon wrapper around prettier that caches the module in memory,
-- making formatting ~50x faster after the first run.
--
-- Conform (LazyVim's formatter) has a built-in prettierd formatter that:
--   - Looks for prettier config files in parent dirs (cwd detection)
--   - Falls back to node_modules/.bin/prettierd
--   - Supports range formatting
--
-- Only formats files when a prettier config file is present in the project.

vim.g.lazyvim_prettier_needs_config = true

local supported = {
  "css", "graphql", "handlebars", "html",
  "javascript", "javascriptreact",
  "json", "jsonc", "less",
  "markdown", "markdown.mdx", "scss",
  "typescript", "typescriptreact",
  "vue", "yaml",
}

return {
  -- Override conform.nvim to use prettierd instead of plain prettier
  {
    "stevearc/conform.nvim",
    optional = true,
    opts = function(_, opts)
      opts.formatters_by_ft = opts.formatters_by_ft or {}
      for _, ft in ipairs(supported) do
        opts.formatters_by_ft[ft] = opts.formatters_by_ft[ft] or {}
        -- Replace 'prettier' with 'prettierd' for this filetype
        opts.formatters_by_ft[ft] = vim.tbl_map(function(v)
          return v == "prettier" and "prettierd" or v
        end, opts.formatters_by_ft[ft])
      end
    end,
  },

  -- Install prettierd via mason
  {
    "mason-org/mason.nvim",
    opts = function(_, opts)
      opts.ensure_installed = opts.ensure_installed or {}
      vim.list_extend(opts.ensure_installed, { "prettierd" })
    end,
  },
}
