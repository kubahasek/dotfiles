-- Vercel colorscheme – adapted from Zed Vercel Dark / Vercel Light themes
return {
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "vercel",
    },
  },
  -- Optional: command to toggle light/dark
  {
    "folke/which-key.nvim",
    optional = true,
    opts = {
      spec = {
        {
          mode = { "n" },
          { "<leader>uC", group = "colorscheme" },
          { "<leader>uCd", "<cmd>lua require('vercel').dark_mode()<cr>", desc = "Vercel Dark" },
          { "<leader>uCl", "<cmd>lua require('vercel').light_mode()<cr>", desc = "Vercel Light" },
        },
      },
    },
  },
}
