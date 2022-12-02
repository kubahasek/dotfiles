return require('packer').startup(function(use)

  -- Packer can manage itself
  use 'wbthomason/packer.nvim'

  -- Discord Presence
  use {

    'andweeb/presence.nvim',
    config = [[ require("plugins/discordconfig") ]]

  }

  -- file-browser
  use { "nvim-telescope/telescope-file-browser.nvim" }
  -- Fuzzy Finder (Telescope)
  use {
    'nvim-telescope/telescope.nvim', tag = '0.1.0',
    requires = { { 'nvim-lua/plenary.nvim' } },
    config = [[ require("plugins/telescope") ]]
  }

  -- null-ls
  use { "jose-elias-alvarez/null-ls.nvim", config = [[ require("plugins/nullls") ]] }

  -- treesitter
  use {
    'nvim-treesitter/nvim-treesitter',
    run = ':TSUpdate'
  }


  -- theme
  use {
    "catppuccin/nvim",
    as = "catppuccin",
    config = function()
      vim.g.catppuccin_flavour = "mocha" -- latte, frappe, macchiato, mocha
      require("catppuccin").setup()
      vim.api.nvim_command "colorscheme catppuccin"
    end
  }

  -- lspconfig
  use {
    'neovim/nvim-lspconfig', -- Configurations for Nvim LSP
    config = [[require("plugins/lspconfig")]]
  }

  use { "folke/trouble.nvim", requires = "kyazdani42/nvim-web-devicons", config = [[ require("plugins/trouble") ]] }

  -- autocompletion
  use { 'hrsh7th/cmp-nvim-lsp', config = [[ require("plugins/cmp") ]] }
  use 'hrsh7th/cmp-buffer'
  use 'hrsh7th/cmp-path'
  use 'hrsh7th/cmp-cmdline'
  use 'hrsh7th/nvim-cmp'
  use 'hrsh7th/cmp-nvim-lsp-signature-help'

  -- snippets
  use 'hrsh7th/cmp-vsnip'
  use 'hrsh7th/vim-vsnip'
  use "rafamadriz/friendly-snippets"
  -- surround
  use({
    "kylechui/nvim-surround",
    tag = "*", -- Use for stability; omit to use `main` branch for the latest features
    config = [[ require("plugins/surround") ]]
  })


  -- bufferline
  use { 'akinsho/bufferline.nvim', tag = "v3.*", requires = 'kyazdani42/nvim-web-devicons',
    config = [[ require("plugins/bufferline") ]] }

  -- gitsigns
  use {
    'lewis6991/gitsigns.nvim',
    tag = 'release',
    config = [[ require("plugins/gitsigns") ]]
  }

  -- lualine
  use {
    'nvim-lualine/lualine.nvim',
    config = [[ require("plugins/lualine") ]]
  }

  -- mason
  use { "williamboman/mason-lspconfig.nvim" }
  use { "williamboman/mason.nvim", config = [[ require("plugins/mason") ]] }
  use { "WhoIsSethDaniel/mason-tool-installer.nvim", config = [[ require("plugins/mason") ]] }
  -- php formatter
  -- use { 'praem90/nvim-phpcsf', config = [[ require("plugins/phpcsf") ]]}

  use "wakatime/vim-wakatime"
end)
