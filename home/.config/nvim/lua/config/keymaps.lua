-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here

-- Copy selection to system clipboard (+" register)
vim.keymap.set("x", "<C-y>", '"+y', { desc = "Yank to system clipboard" })

-- Paste from system clipboard (+" register)
vim.keymap.set({ "n", "x" }, "<C-p>", '"+p', { desc = "Paste from system clipboard" })

-- Also paste before cursor from system clipboard
vim.keymap.set({ "n", "x" }, "<S-C-p>", '"+P', { desc = "Paste before cursor from system clipboard" })
