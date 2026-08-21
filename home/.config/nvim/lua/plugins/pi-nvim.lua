return {
  "carderne/pi-nvim",
  config = function()
    require("pi-nvim").setup({
      socket_path = nil, -- auto-discover
      set_default_keymaps = true,
    })

    local map = vim.keymap.set

    -- Quick prompt
    map("n", "<leader>pp", ":PiSend<CR>", { desc = "Pi: send prompt" })

    -- Send file
    map("n", "<leader>pf", ":PiSendFile<CR>", { desc = "Pi: send file" })

    -- Send selection (visual mode)
    map("v", "<leader>ps", ":PiSendSelection<CR>", { desc = "Pi: send selection" })

    -- Send buffer
    map("n", "<leader>pb", ":PiSendBuffer<CR>", { desc = "Pi: send buffer" })

    -- Ping
    map("n", "<leader>pi", ":PiPing<CR>", { desc = "Pi: ping" })
  end,
}
