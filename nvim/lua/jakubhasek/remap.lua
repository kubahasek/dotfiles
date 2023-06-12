vim.g.mapleader = " "
vim.keymap.set("n", "<leader>pv", vim.cmd.Ex)

vim.keymap.set('n', '<leader>dd', function() require("duck").hatch("🐕") end, {})
vim.keymap.set('n', '<leader>dk', function() require("duck").cook() end, {})

vim.keymap.set("v", "J", ":m '>+1<CR>gv=gv")
vim.keymap.set("v", "K", ":m '<-2<CR>gv=gv")

vim.keymap.set("n", "J", "mzJ`z")
vim.keymap.set("n", "<C-d>", "<C-d>zz")
vim.keymap.set("n", "<C-u>", "<C-u>zz")
vim.keymap.set("n", "n", "nzzzv")
vim.keymap.set("n", "N", "Nzzzv")

vim.keymap.set('n', '<leader>h', ':FocusSplitLeft<CR>', { silent = true })
vim.keymap.set('n', '<leader>j', ':FocusSplitDown<CR>', { silent = true })
vim.keymap.set('n', '<leader>k', ':FocusSplitUp<CR>', { silent = true })
vim.keymap.set('n', '<leader>l', ':FocusSplitRight<CR>', { silent = true })

vim.keymap.set('n', '<leader>ft', ':NvimTreeToggle<CR>')

vim.keymap.set({ 'n' }, '<C-k>', function()       require('lsp_signature').toggle_float_win()
end, { silent = true, noremap = true, desc = 'toggle signature' })
-- greatest remap ever
vim.keymap.set("n", "<leader>x", "<cmd>!chmod +x %<CR>", { silent = true })
vim.keymap.set("x", "<leader>p", [["_dP]])

-- next greatest remap ever : asbjornHaland
vim.keymap.set({ "n", "v" }, "<leader>y", [["+y]])
vim.keymap.set("n", "<leader>Y", [["+Y]])
vim.keymap.set({ "n", "v" }, "<leader>d", [["_d]])

vim.keymap.set("n", "Q", "<nop>")
vim.keymap.set("n", "<leader>f", vim.lsp.buf.format)

vim.keymap.set("n", "<C-k>", "<cmd>cnext<CR>zz")
vim.keymap.set("n", "<C-j>", "<cmd>cprev<CR>zz")
vim.keymap.set("n", "<leader>k", "<cmd>lnext<CR>zz")
vim.keymap.set("n", "<leader>j", "<cmd>lprev<CR>zz")

vim.keymap.set("n", "<leader>s", [[:%s/\<<C-r><C-w>\>/<C-r><C-w>/gI<Left><Left><Left>]])
vim.keymap.set("n", "<leader>lg", "<cmd>LazyGit<CR>")
