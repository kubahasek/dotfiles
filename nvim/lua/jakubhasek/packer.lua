-- This file can be loaded by calling `lua require('plugins')` from your init.vim

-- Only required if you have packer configured as `opt`

vim.cmd.packadd('packer.nvim')

return require('packer').startup(function(use)
    -- Packer can manage itself
    use 'wbthomason/packer.nvim'

    -- null-ls
    use { "jose-elias-alvarez/null-ls.nvim" }

    use {"github/copilot.vim"}

    use {

        'nvim-telescope/telescope.nvim', tag = '0.1.0',
        -- or                            , branch = '0.1.x',
        requires = { { 'nvim-lua/plenary.nvim' } }
    }

    use("kyazdani42/nvim-web-devicons")
	use("kyazdani42/nvim-tree.lua")

    use { "catppuccin/nvim", as = "catppuccin", config = function()
        vim.cmd.colorscheme "catppuccin-mocha"
    end }

    use {
        "folke/todo-comments.nvim",
        requires = "nvim-lua/plenary.nvim",
    }

    use {
      "ray-x/lsp_signature.nvim",
    }

    use { "beauwilliams/focus.nvim", config = function() require("focus").setup() end }

    use {
      'rmagatti/auto-session',
      config = function()
        require("auto-session").setup {
          log_level = "error",
          auto_session_suppress_dirs = { "~/", "~/Projects", "~/Downloads", "/"},
        }
      end
    }


    use('nvim-treesitter/nvim-treesitter', { run = ':TSUpdate' })
    use("windwp/nvim-ts-autotag")
    use {
    "windwp/nvim-autopairs",
    config = function() require("nvim-autopairs").setup {} end
    }
    use('ThePrimeagen/harpoon')

    use("windwp/windline.nvim")

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
        "tpope/vim-surround",
    })

    use "wakatime/vim-wakatime"

    use { "kdheepak/lazygit.nvim" }

end)
