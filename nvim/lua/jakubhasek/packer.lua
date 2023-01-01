-- This file can be loaded by calling `lua require('plugins')` from your init.vim

-- Only required if you have packer configured as `opt`

vim.cmd.packadd('packer.nvim')

return require('packer').startup(function(use)
    -- Packer can manage itself
    use 'wbthomason/packer.nvim'

    -- null-ls
    use { "jose-elias-alvarez/null-ls.nvim" }

    -- duck
    use {
        'tamton-aquib/duck.nvim'
    }


    use {

        'nvim-telescope/telescope.nvim', tag = '0.1.0',
        -- or                            , branch = '0.1.x',
        requires = { { 'nvim-lua/plenary.nvim' } }
    }

    use { "catppuccin/nvim", as = "catppuccin", config = function()
        vim.cmd.colorscheme "catppuccin-mocha"
    end }

    use('nvim-treesitter/nvim-treesitter', { run = ':TSUpdate' })
    use('ThePrimeagen/harpoon')

    -- mason
    use { "williamboman/mason-lspconfig.nvim" }
    use { "williamboman/mason.nvim" }
    use { "WhoIsSethDaniel/mason-tool-installer.nvim" }

    use("tpope/vim-fugitive")
    use {
        'VonHeikemen/lsp-zero.nvim',
        requires = {
            -- LSP Support
            { 'neovim/nvim-lspconfig' },

            -- Autocompletion
            { 'hrsh7th/nvim-cmp' },
            { 'hrsh7th/cmp-buffer' },
            { 'hrsh7th/cmp-path' },
            { 'saadparwaiz1/cmp_luasnip' },
            { 'hrsh7th/cmp-nvim-lsp' },
            { 'hrsh7th/cmp-nvim-lua' },

            -- Snippets
            { 'L3MON4D3/LuaSnip' },
            { 'rafamadriz/friendly-snippets' },
        }
    }

    use { "folke/trouble.nvim", requires = "kyazdani42/nvim-web-devicons" }
    use {

        'andweeb/presence.nvim'
    }

    -- comment line
    use { "terrortylor/nvim-comment" }

    -- gitsigns
    use {
        'lewis6991/gitsigns.nvim',
        tag = 'release'
    }

    -- surround
    use({
        "kylechui/nvim-surround",
        tag = "*" -- Use for stability; omit to use `main` branch for the latest features
    })

    use "wakatime/vim-wakatime"

end)
