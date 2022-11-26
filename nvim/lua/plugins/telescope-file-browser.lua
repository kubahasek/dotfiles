-- You don't need to set any of these options.
-- IMPORTANT!: this is only a showcase of how you can set default options!
require("telescope").setup {
  extensions = {
    file_browser = {
      theme = "catppuccin",
      -- disables netrw and use telescope-file-browser in its place
      hijack_netrw = true,
      respect_gitignore = false,
      },
    },
  }
-- To get telescope-file-browser loaded and working with telescope,
-- you need to call load_extension, somewhere after setup function:
