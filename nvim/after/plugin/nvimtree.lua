-- empty setup using defaults
require("nvim-tree").setup({
    sort_by = "case_sensitive",
    view = {
      width = 90,
    side = "right",
    },
    actions = {
        open_file = {
            quit_on_open = true,
}
},
    renderer = {
      group_empty = true,
    },
    filters = {
      dotfiles = false,
    },
  })
