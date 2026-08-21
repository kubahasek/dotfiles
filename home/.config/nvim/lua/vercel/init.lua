-- Vercel colorscheme for Neovim
-- Module at lua/vercel/init.lua so require("vercel") works
-- colors/vercel.lua is a thin wrapper that calls require("vercel").load()

local M = {}

M.dark = {
  bg           = "#0a0a0a",
  bg_darker    = "#000000",
  bg_elevated  = "#000000",
  bg_element   = "#1f1f1f",
  bg_hover     = "#1a1a1a",
  bg_active    = "#1a1a1a",
  bg_tab_inactive = "#111111",
  border       = "#2e2e2e",
  fg           = "#ededed",
  fg_muted     = "#a1a1a1",
  fg_line      = "#878787",
  fg_line_active = "#ededed",

  blue         = "#52a8ff",
  purple       = "#c472fb",
  pink         = "#f75f8f",
  green        = "#62c073",
  yellow       = "#ff9907",
  cyan         = "#1da9b0",
  gray         = "#a1a1a1",
  dark_gray    = "#676767",
  ansi_black   = "#000000",
  ansi_bright_white = "#ededed",

  keyword      = "#f75f8f",
  func         = "#c472fb",
  type         = "#c472fb",
  string       = "#62c073",
  number       = "#52a8ff",
  comment      = "#a1a1a1",
  property     = "#52a8ff",
  attribute    = "#c472fb",
  constructor  = "#62c073",
  boolean      = "#52a8ff",
  tag          = "#62c073",
  operator     = "#f75f8f",
  constant     = "#52a8ff",
  variable     = "#ededed",
  special_var  = "#52a8ff",
  label        = "#52a8ff",
  title        = "#52a8ff",
  link         = "#52a8ff",

  error        = "#f75f8f",
  warn         = "#ff9907",
  info         = "#52a8ff",
  hint         = "#a1a1a1",
  success      = "#62c073",

  added        = "#62c073",
  changed      = "#ff9907",
  removed      = "#f75f8f",

  -- Pre-blended against bg; Neovim highlights do not accept #RRGGBBAA.
  visual_bg    = "#182a3b",

  diag_error_bg = "#221318",
  diag_warn_bg  = "#23190a",
  diag_info_bg  = "#111a23",
  diag_hint_bg  = "#191919",
  diag_ok_bg    = "#131d15",

  diff_add_bg    = "#1c2e1f",
  diff_change_bg = "#3b2709",
  diff_delete_bg = "#391b25",
  diff_text_bg   = "#182a3b",
}

M.light = {
  bg           = "#ffffff",
  bg_darker    = "#f5f5f5",
  bg_elevated  = "#ffffff",
  bg_element   = "#ebebeb",
  bg_hover     = "#e5e5e5",
  bg_active    = "#e5e5e5",
  bg_tab_inactive = "#f5f5f5",
  border       = "#ebebeb",
  fg           = "#171717",
  fg_muted     = "#666666",
  fg_line      = "#a8a8a8",
  fg_line_active = "#171717",

  blue         = "#0068d6",
  purple       = "#7c00c7",
  pink         = "#bd2864",
  green        = "#297a3a",
  yellow       = "#A35200",
  cyan         = "#449999",
  gray         = "#666666",
  dark_gray    = "#666666",
  ansi_black   = "#171717",
  ansi_bright_white = "#666666",

  keyword      = "#bd2864",
  func         = "#7c00c7",
  type         = "#7c00c7",
  string       = "#297a3a",
  number       = "#0068d6",
  comment      = "#666666",
  property     = "#0068d6",
  attribute    = "#7c00c7",
  constructor  = "#297a3a",
  boolean      = "#0068d6",
  tag          = "#297a3a",
  operator     = "#bd2864",
  constant     = "#0068d6",
  variable     = "#171717",
  special_var  = "#0068d6",
  label        = "#0068d6",
  title        = "#0068d6",
  link         = "#0068d6",

  error        = "#bd2864",
  warn         = "#A35200",
  info         = "#0068d6",
  hint         = "#666666",
  success      = "#297a3a",

  added        = "#297a3a",
  changed      = "#A35200",
  removed      = "#bd2864",

  -- Pre-blended against bg; Neovim highlights do not accept #RRGGBBAA.
  visual_bg    = "#cce1f7",

  diag_error_bg = "#f8e9ef",
  diag_warn_bg  = "#f5ede5",
  diag_info_bg  = "#e5f0fb",
  diag_hint_bg  = "#efefef",
  diag_ok_bg    = "#e9f1eb",

  diff_add_bg    = "#d4e4d8",
  diff_change_bg = "#edddcc",
  diff_delete_bg = "#f2d4e0",
  diff_text_bg   = "#cce1f7",
}

---@param p table color palette
local function setup(p)
  local h = vim.api.nvim_set_hl
  local bg = p.bg
  local fg = p.fg

  -- ── Editor ───────────────────────────────────────────────
  h(0, "Normal",        { fg = fg, bg = bg })
  h(0, "NormalFloat",   { fg = fg, bg = p.bg_elevated })
  h(0, "NormalNC",      { fg = p.fg_muted, bg = bg })
  h(0, "ColorColumn",   { bg = p.bg_hover })
  h(0, "CursorColumn",  { bg = p.bg_hover })
  h(0, "CursorLine",    { bg = p.bg_active })
  h(0, "CursorLineNr",  { fg = p.fg_line_active, bg = p.bg_active })
  h(0, "LineNr",        { fg = p.fg_line, bg = bg })
  h(0, "LineNrAbove",   { fg = p.fg_line, bg = bg })
  h(0, "LineNrBelow",   { fg = p.fg_line, bg = bg })
  h(0, "SignColumn",    { bg = bg })
  h(0, "FoldColumn",    { fg = p.fg_muted, bg = bg })
  h(0, "Folded",        { fg = p.fg_muted, bg = p.bg_element })
  h(0, "NonText",       { fg = p.fg_line })
  h(0, "Whitespace",    { fg = p.fg_line })
  h(0, "Conceal",       { fg = p.fg_muted, bg = bg })
  h(0, "EndOfBuffer",   { fg = bg })
  h(0, "Directory",     { fg = p.blue })
  h(0, "Title",         { fg = p.title, bold = true })
  h(0, "MatchParen",    { fg = p.fg, bg = p.bg_element, bold = true })
  h(0, "SpecialKey",    { fg = p.pink })

  -- ── Search ───────────────────────────────────────────────
  h(0, "Search",        { fg = p.bg, bg = p.yellow })
  h(0, "IncSearch",     { fg = p.bg, bg = p.yellow })
  h(0, "CurSearch",     { fg = p.bg, bg = p.yellow })
  h(0, "Substitute",    { fg = p.bg, bg = p.green })

  -- ── Selection ────────────────────────────────────────────
  h(0, "Visual",        { bg = p.visual_bg })
  h(0, "VisualNOS",     { bg = p.bg_element })

  -- ── Statusline / Tabline ─────────────────────────────────
  h(0, "StatusLine",    { fg = fg, bg = p.bg_darker })
  h(0, "StatusLineNC",  { fg = p.fg_muted, bg = p.bg_darker })
  h(0, "TabLine",       { fg = p.fg_muted, bg = p.bg_tab_inactive })
  h(0, "TabLineFill",   { bg = p.bg_tab_inactive })
  h(0, "TabLineSel",    { fg = fg, bg = p.bg_darker, bold = true })

  -- ── Splits & Borders ─────────────────────────────────────
  h(0, "VertSplit",     { fg = p.border, bg = bg })
  h(0, "WinSeparator",  { fg = p.border })
  h(0, "FloatBorder",   { fg = p.border })

  -- ── Popup Menu ───────────────────────────────────────────
  h(0, "Pmenu",         { fg = fg, bg = p.bg_element })
  h(0, "PmenuSel",      { fg = fg, bg = p.bg_hover })
  h(0, "PmenuSbar",     { bg = p.bg_element })
  h(0, "PmenuThumb",    { bg = p.border })

  -- ── Messages ─────────────────────────────────────────────
  h(0, "ErrorMsg",      { fg = p.error, bold = true })
  h(0, "WarningMsg",    { fg = p.warn, bold = true })
  h(0, "ModeMsg",       { fg = fg })
  h(0, "MoreMsg",       { fg = p.blue })
  h(0, "Question",      { fg = p.green })
  h(0, "QuickFixLine",  { bg = p.bg_hover })
  h(0, "MsgArea",       { fg = fg })

  -- ── Spelling ─────────────────────────────────────────────
  h(0, "SpellBad",      { sp = p.error, undercurl = true })
  h(0, "SpellCap",      { sp = p.blue, undercurl = true })
  h(0, "SpellLocal",    { sp = p.cyan, undercurl = true })
  h(0, "SpellRare",     { sp = p.purple, undercurl = true })

  -- ── Diagnostics ──────────────────────────────────────────
  local diag = {
    Error = { fg = p.error, bg = p.diag_error_bg },
    Warn  = { fg = p.warn,  bg = p.diag_warn_bg },
    Info  = { fg = p.info,  bg = p.diag_info_bg },
    Hint  = { fg = p.hint,  bg = p.diag_hint_bg },
    Ok    = { fg = p.green, bg = p.diag_ok_bg },
  }
  for sev, attrs in pairs(diag) do
    h(0, "Diagnostic" .. sev, { fg = attrs.fg })
    h(0, "DiagnosticSign" .. sev, { fg = attrs.fg })
    h(0, "DiagnosticUnderline" .. sev, { sp = attrs.fg, undercurl = true })
    h(0, "DiagnosticVirtualText" .. sev, { fg = attrs.fg, bg = attrs.bg })
    h(0, "DiagnosticFloating" .. sev, { fg = attrs.fg })
  end

  -- ── Diff ─────────────────────────────────────────────────
  h(0, "DiffAdd",       { bg = p.diff_add_bg })
  h(0, "DiffChange",    { bg = p.diff_change_bg })
  h(0, "DiffDelete",    { bg = p.diff_delete_bg })
  h(0, "DiffText",      { bg = p.diff_text_bg })
  h(0, "DiffAdded",     { fg = p.added })
  h(0, "DiffChanged",   { fg = p.changed })
  h(0, "DiffRemoved",   { fg = p.removed })

  -- ── Standard syntax ──────────────────────────────────────
  h(0, "Comment",       { fg = p.comment, italic = true })
  h(0, "Constant",      { fg = p.constant })
  h(0, "String",        { fg = p.string })
  h(0, "Character",     { fg = p.string })
  h(0, "Number",        { fg = p.number })
  h(0, "Boolean",       { fg = p.boolean })
  h(0, "Float",         { fg = p.number })
  h(0, "Identifier",    { fg = p.variable })
  h(0, "Function",      { fg = p.func })
  h(0, "Statement",     { fg = p.keyword })
  h(0, "Conditional",   { fg = p.keyword })
  h(0, "Repeat",        { fg = p.keyword })
  h(0, "Label",         { fg = p.label })
  h(0, "Operator",      { fg = p.operator })
  h(0, "Keyword",       { fg = p.keyword })
  h(0, "Exception",     { fg = p.keyword })
  h(0, "PreProc",       { fg = p.purple })
  h(0, "Include",       { fg = p.purple })
  h(0, "Define",        { fg = p.purple })
  h(0, "Macro",         { fg = p.purple })
  h(0, "PreCondit",     { fg = p.purple })
  h(0, "Type",          { fg = p.type })
  h(0, "StorageClass",  { fg = p.keyword })
  h(0, "Structure",     { fg = p.keyword })
  h(0, "Typedef",       { fg = p.type })
  h(0, "Special",       { fg = p.cyan })
  h(0, "SpecialChar",   { fg = p.cyan })
  h(0, "SpecialComment",{ fg = p.comment, italic = true })
  h(0, "Tag",           { fg = p.tag })
  h(0, "Delimiter",     { fg = fg })
  h(0, "Debug",         { fg = p.pink })
  h(0, "Underlined",    { fg = p.link, underline = true })
  h(0, "Bold",          { bold = true })
  h(0, "Italic",        { italic = true })
  h(0, "Error",         { fg = p.error })

  -- ── Treesitter ───────────────────────────────────────────
  local ts = {
    ["@attribute"]           = { fg = p.attribute },
    ["@boolean"]             = { fg = p.boolean },
    ["@character"]           = { fg = p.string },
    ["@comment"]             = { fg = p.comment, italic = true },
    ["@conditional"]         = { fg = p.keyword },
    ["@constant"]            = { fg = p.constant },
    ["@constant.builtin"]    = { fg = p.constant },
    ["@constant.macro"]      = { fg = p.constant },
    ["@constructor"]         = { fg = p.constructor },
    ["@exception"]           = { fg = p.keyword },
    ["@field"]               = { fg = p.variable },
    ["@float"]               = { fg = p.number },
    ["@function"]            = { fg = p.func },
    ["@function.builtin"]    = { fg = p.func },
    ["@function.call"]       = { fg = p.func },
    ["@function.macro"]      = { fg = p.func },
    ["@include"]             = { fg = p.purple },
    ["@keyword"]             = { fg = p.keyword },
    ["@keyword.function"]    = { fg = p.keyword },
    ["@keyword.operator"]    = { fg = p.operator },
    ["@keyword.return"]      = { fg = p.keyword },
    ["@label"]               = { fg = p.label },
    ["@method"]              = { fg = p.func },
    ["@method.call"]         = { fg = p.func },
    ["@namespace"]           = { fg = p.type },
    ["@number"]              = { fg = p.number },
    ["@operator"]            = { fg = p.operator },
    ["@parameter"]           = { fg = p.variable },
    ["@property"]            = { fg = p.property },
    ["@punctuation.delimiter"] = { fg = fg },
    ["@punctuation.bracket"] = { fg = fg },
    ["@punctuation.special"] = { fg = p.cyan },
    ["@repeat"]              = { fg = p.keyword },
    ["@storageclass"]        = { fg = p.keyword },
    ["@string"]              = { fg = p.string },
    ["@string.escape"]       = { fg = p.cyan },
    ["@string.regex"]        = { fg = p.string },
    ["@string.special"]      = { fg = p.string },
    ["@symbol"]              = { fg = p.cyan },
    ["@tag"]                 = { fg = p.tag },
    ["@tag.attribute"]       = { fg = p.attribute },
    ["@tag.delimiter"]       = { fg = fg },
    ["@text"]                = { fg = fg },
    ["@text.danger"]         = { fg = p.error },
    ["@text.emphasis"]       = { italic = true },
    ["@text.literal"]        = { fg = p.string },
    ["@text.note"]           = { fg = p.info },
    ["@text.reference"]      = { fg = p.link },
    ["@text.strong"]         = { bold = true },
    ["@text.title"]          = { fg = p.title, bold = true },
    ["@text.underline"]      = { underline = true },
    ["@text.uri"]            = { fg = p.link, underline = true },
    ["@text.warning"]        = { fg = p.warn },
    ["@type"]                = { fg = p.type },
    ["@type.builtin"]        = { fg = p.type },
    ["@type.definition"]     = { fg = p.type },
    ["@variable"]            = { fg = p.variable },
    ["@variable.builtin"]    = { fg = p.special_var },
  }
  for group, attrs in pairs(ts) do
    h(0, group, attrs)
  end

  -- ── LSP Semantic Tokens ──────────────────────────────────
  local lsp = {
    ["@lsp.type.class"]         = { fg = p.type },
    ["@lsp.type.comment"]       = { fg = p.comment, italic = true },
    ["@lsp.type.enum"]          = { fg = p.type },
    ["@lsp.type.enumMember"]    = { fg = p.constant },
    ["@lsp.type.function"]      = { fg = p.func },
    ["@lsp.type.interface"]     = { fg = p.type },
    ["@lsp.type.keyword"]       = { fg = p.keyword },
    ["@lsp.type.macro"]         = { fg = p.constant },
    ["@lsp.type.method"]        = { fg = p.func },
    ["@lsp.type.namespace"]     = { fg = p.type },
    ["@lsp.type.number"]        = { fg = p.number },
    ["@lsp.type.operator"]      = { fg = p.operator },
    ["@lsp.type.parameter"]     = { fg = p.variable },
    ["@lsp.type.property"]      = { fg = p.property },
    ["@lsp.type.string"]        = { fg = p.string },
    ["@lsp.type.struct"]        = { fg = p.type },
    ["@lsp.type.type"]          = { fg = p.type },
    ["@lsp.type.typeParameter"] = { fg = p.type },
    ["@lsp.type.variable"]      = { fg = p.variable },
    ["@lsp.type.decorator"]     = { fg = p.attribute },
    ["@lsp.type.event"]         = { fg = p.attribute },
    ["@lsp.type.modifier"]      = { fg = p.keyword },
    ["@lsp.type.regexp"]        = { fg = p.string },
    ["@lsp.type.escapeSequence"]= { fg = p.cyan },
  }
  for group, attrs in pairs(lsp) do
    h(0, group, attrs)
  end

  -- ── Plugins ──────────────────────────────────────────────
  h(0, "TelescopeNormal",         { fg = fg, bg = p.bg_darker })
  h(0, "TelescopeBorder",         { fg = p.border })
  h(0, "TelescopePromptBorder",   { fg = p.blue })
  h(0, "TelescopePromptNormal",   { fg = fg, bg = p.bg_darker })
  h(0, "TelescopePromptPrefix",   { fg = p.blue })
  h(0, "TelescopeSelection",      { fg = fg, bg = p.bg_hover })
  h(0, "TelescopeSelectionCaret", { fg = p.blue })
  h(0, "TelescopeMatching",       { fg = p.blue, bold = true })
  h(0, "TelescopeResultsNormal",  { bg = p.bg_darker })
  h(0, "TelescopePreviewNormal",  { fg = fg, bg = p.bg })
  h(0, "TelescopeTitle",          { fg = p.blue })

  h(0, "CmpItemAbbr",              { fg = fg })
  h(0, "CmpItemAbbrDeprecated",    { fg = p.fg_muted, strikethrough = true })
  h(0, "CmpItemAbbrMatch",         { fg = p.blue, bold = true })
  h(0, "CmpItemAbbrMatchFuzzy",    { fg = p.blue })
  h(0, "CmpItemKind",              { fg = p.fg_muted })
  h(0, "CmpItemKindClass",         { fg = p.type })
  h(0, "CmpItemKindFunction",      { fg = p.func })
  h(0, "CmpItemKindInterface",     { fg = p.type })
  h(0, "CmpItemKindKeyword",       { fg = p.keyword })
  h(0, "CmpItemKindMethod",        { fg = p.func })
  h(0, "CmpItemKindProperty",      { fg = p.property })
  h(0, "CmpItemKindSnippet",       { fg = p.cyan })
  h(0, "CmpItemKindVariable",      { fg = p.variable })
  h(0, "CmpDoc",                   { fg = p.fg_muted })
  h(0, "CmpDocBorder",             { fg = p.border })

  h(0, "LazyNormal",   { fg = fg, bg = p.bg_darker })
  h(0, "LazyButton",   { fg = fg, bg = p.bg_element })
  h(0, "LazyH1",       { fg = p.blue, bold = true })
  h(0, "LazyH2",       { fg = p.purple, bold = true })
  h(0, "LazyReasonPlugin", { fg = p.purple })

  h(0, "MiniStarterCurrent",  { fg = p.blue, bold = true })
  h(0, "MiniStarterHeader",   { fg = p.purple })
  h(0, "MiniStarterItem",     { fg = fg })
  h(0, "MiniStarterItemBullet", { fg = p.fg_muted })
  h(0, "MiniStarterItemPrefix", { fg = p.warn })
  h(0, "MiniStarterSection",  { fg = p.blue, bold = true })
  h(0, "MiniStarterQuery",    { fg = fg })
  h(0, "MiniFilesNormal",     { fg = fg, bg = p.bg_darker })

  h(0, "NoiceCmdlinePopup",     { fg = fg, bg = p.bg_darker })
  h(0, "NoiceCmdlinePopupBorder", { fg = p.border })

  h(0, "WhichKey",          { fg = p.blue })
  h(0, "WhichKeyDesc",      { fg = fg })
  h(0, "WhichKeySeparator", { fg = p.fg_muted })
  h(0, "WhichKeyGroup",     { fg = p.purple })
  h(0, "WhichKeyValue",     { fg = p.fg_muted })
  h(0, "WhichKeyFloat",     { bg = p.bg_darker })

  h(0, "NotifyERRORBorder", { fg = p.error })
  h(0, "NotifyWARNBorder",  { fg = p.warn })
  h(0, "NotifyINFOBorder",  { fg = p.info })
  h(0, "NotifyDEBUGBorder", { fg = p.fg_muted })

  h(0, "GitSignsAdd",    { fg = p.added })
  h(0, "GitSignsChange", { fg = p.changed })
  h(0, "GitSignsDelete", { fg = p.removed })

  -- ── Terminal colors (for :terminal) ──────────────────────
  vim.g.terminal_color_0  = p.ansi_black
  vim.g.terminal_color_8  = p.dark_gray
  vim.g.terminal_color_1  = p.pink
  vim.g.terminal_color_9  = p.pink
  vim.g.terminal_color_2  = p.green
  vim.g.terminal_color_10 = p.green
  vim.g.terminal_color_3  = p.yellow
  vim.g.terminal_color_11 = p.yellow
  vim.g.terminal_color_4  = p.blue
  vim.g.terminal_color_12 = p.blue
  vim.g.terminal_color_5  = p.purple
  vim.g.terminal_color_13 = p.purple
  vim.g.terminal_color_6  = p.cyan
  vim.g.terminal_color_14 = p.cyan
  vim.g.terminal_color_7  = p.gray
  vim.g.terminal_color_15 = p.ansi_bright_white
end

--- Apply Vercel colorscheme
function M.load()
  vim.cmd.highlight("clear")
  if vim.fn.exists("syntax_on") then
    vim.cmd.syntax("reset")
  end

  vim.o.termguicolors = true
  vim.g.colors_name = "vercel"

  if vim.o.background == "light" then
    setup(M.light)
  else
    setup(M.dark)
  end
end

function M.dark_mode()
  vim.o.background = "dark"
  M.load()
end

function M.light_mode()
  vim.o.background = "light"
  M.load()
end

return M
