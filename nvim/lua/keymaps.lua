vim.api.nvim_set_keymap('', '<Space>', '<Nop>', { noremap = true, silent = true })
vim.g.mapleader = " "

-- telescope keymaps
local builtin = require('telescope.builtin')
vim.keymap.set('n', 'ff', builtin.find_files, {})
vim.keymap.set('n', 'fg', builtin.live_grep, {})
vim.keymap.set('n', 'fb', builtin.buffers, {})
vim.keymap.set('n', 'fh', builtin.help_tags, {})
vim.keymap.set("n", "<space>fb", ":Telescope file_browser<CR>", { noremap = true })

-- bufferline
vim.keymap.set('n', "<leader>bc",  ":bdelete<CR>", { noremap = true })
vim.keymap.set('n', "<leader>bn",  ":bnext<CR>", { noremap = true })
vim.keymap.set('n', "<leader>bp",  ":bprev<CR>", { noremap = true })

-- null-ls
vim.keymap.set('n', '<leader>f', ':vim.lsp.buf.format({ timeout_ms = 10000 })')



