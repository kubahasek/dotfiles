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

--barbar
-- Move to previous/next
vim.keymap.set('n', '<C-,>', '<Cmd>BufferPrevious<CR>', opts)
vim.keymap.set('n', '<C-.>', '<Cmd>BufferNext<CR>', opts)
-- Re-order to previous/next
vim.keymap.set('n', '<A-<>', '<Cmd>BufferMovePrevious<CR>', opts)
vim.keymap.set('n', '<A->>', '<Cmd>BufferMoveNext<CR>', opts)
-- Goto buffer in position...
vim.keymap.set('n', '<C-+>', '<Cmd>BufferGoto 1<CR>', opts)
vim.keymap.set('n', '<C-ě>', '<Cmd>BufferGoto 2<CR>', opts)
vim.keymap.set('n', '<C-š>', '<Cmd>BufferGoto 3<CR>', opts)
vim.keymap.set('n', '<C-č>', '<Cmd>BufferGoto 4<CR>', opts)
vim.keymap.set('n', '<C-é>', '<Cmd>BufferGoto 5<CR>', opts)
vim.keymap.set('n', '<C-ž>', '<Cmd>BufferGoto 6<CR>', opts)
vim.keymap.set('n', '<C-ý>', '<Cmd>BufferGoto 7<CR>', opts)
vim.keymap.set('n', '<C-á>', '<Cmd>BufferGoto 8<CR>', opts)
vim.keymap.set('n', '<C-í>', '<Cmd>BufferGoto 9<CR>', opts)
vim.keymap.set('n', '<C-é>', '<Cmd>BufferLast<CR>', opts)
-- Pin/unpin buffer
vim.keymap.set('n', '<A-p>', '<Cmd>BufferPin<CR>', opts)
-- Close buffer
vim.keymap.set('n', '<C-c>', '<Cmd>BufferClose<CR>', opts)
-- Wipeout buffer
--                 :BufferWipeout
-- Close commands
--                 :BufferCloseAllButCurrent
--                 :BufferCloseAllButPinned
--                 :BufferCloseAllButCurrentOrPinned
--                 :BufferCloseBuffersLeft
--                 :BufferCloseBuffersRig
-- Magic buffer-picking mode
vim.keymap.set('n', '<C-p>', '<Cmd>BufferPick<CR>', opts)
-- Sort automatically by...
vim.keymap.set('n', '<Space>bb', '<Cmd>BufferOrderByBufferNumber<CR>', opts)
vim.keymap.set('n', '<Space>bd', '<Cmd>BufferOrderByDirectory<CR>', opts)
vim.keymap.set('n', '<Space>bl', '<Cmd>BufferOrderByLanguage<CR>', opts)
vim.keymap.set('n', '<Space>bw', '<Cmd>BufferOrderByWindowNumber<CR>', opts)

-- Other:
-- :BarbarEnable - enables barbar (enabled by default)
-- :BarbarDisable - very bad command, should never be used
