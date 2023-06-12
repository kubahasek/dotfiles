function ColorMyPencils()
    require("catppuccin").setup({
        flavour = "mocha";
    })
    -- vim.api.nvim_set_hl(0, "NormalNC", { bg = "#000000" })
    -- vim.api.nvim_set_hl(0, "Normal", { bg = "#000000" })
    -- vim.api.nvim_set_hl(0, "TermCursor", { fg = "#000000", bg = "#FFFFFF" })
    -- vim.api.nvim_set_hl(0, "TermCursorNC", { fg = "#000000", bg = "#FFFFFF" })
    -- vim.api.nvim_set_hl(0, "NvimTreeNormal", {fg = "#FFFFFF", bg = "#000000"})
    -- local colors = { black = "#000000", white = "#FFFFFF" }
    -- local TelescopeColor = {
    --     TelescopeMatching = { fg = colors.white },
    --     TelescopeSelection = { bg = colors.black, bold = true },
    --
    --     TelescopePromptPrefix = { bg = colors.black },
    --     TelescopePromptNormal = { fg = colors.white, bg = colors.black },
    --     TelescopeResultsNormal = { bg = colors.black },
    --     TelescopePreviewNormal = { bg = colors.black },
    --     TelescopePromptBorder = { bg = colors.black, },
    --     TelescopeResultsBorder = { bg = colors.black },
    --     TelescopePreviewBorder = { bg = colors.black },
    --     TelescopePromptTitle = { fg = colors.white, bg = colors.black },
    --     TelescopeResultsTitle = { fg = colors.white },
    --     TelescopePreviewTitle = { bg = colors.white },
    -- }
    -- vim.cmd("autocmd Colorscheme * highlight NvimTreeNormal guibg=#000000 guifg=#9da5b3")
    --
    -- for hl, col in pairs(TelescopeColor) do
    --     vim.api.nvim_set_hl(0, hl, col)
    -- end
end

ColorMyPencils()
