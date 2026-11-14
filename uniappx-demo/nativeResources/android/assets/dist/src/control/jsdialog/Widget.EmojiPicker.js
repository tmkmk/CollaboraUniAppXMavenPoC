const _EmojiPickerWidget = class _EmojiPickerWidget {
  constructor(parentContainer, data, builder, _callback) {
    this.query = "";
    this.recents = [];
    this.parentContainer = parentContainer;
    this.data = data;
    this.builder = builder;
  }
  get recentsKey() {
    return this.data.recentsPrefsKey || _EmojiPickerWidget.DEFAULT_RECENTS_KEY;
  }
  get maxRecents() {
    return this.data.maxRecents || _EmojiPickerWidget.DEFAULT_MAX_RECENTS;
  }
  loadRecents() {
    try {
      const arr = JSON.parse(window.prefs.get(this.recentsKey, "[]"));
      this.recents = Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : [];
    } catch {
      this.recents = [];
    }
  }
  saveRecents() {
    window.prefs.set(this.recentsKey, JSON.stringify(this.recents));
  }
  onPick(emoji) {
    this.recents = [emoji, ...this.recents.filter((e) => e !== emoji)].slice(0, this.maxRecents);
    this.saveRecents();
    this.builder.callback("emojipicker", "change", this.container, emoji, this.builder);
  }
  // Look up the first search keyword for an emoji glyph. Used for
  // aria-label so screen readers announce e.g. "smile" rather than
  // stumbling on the raw codepoint. Returns '' if not in the catalogue.
  firstKeyword(emoji) {
    for (const cat of _EmojiPickerWidget.CATEGORIES) {
      for (const entry of cat.emojis) {
        if (entry.e === emoji) {
          const space = entry.k.indexOf(" ");
          return space === -1 ? entry.k : entry.k.slice(0, space);
        }
      }
    }
    return "";
  }
  appendSection(title, emojis) {
    const heading = window.L.DomUtil.create("div", "ui-emoji-picker-heading", this.grid);
    heading.setAttribute("role", "heading");
    heading.setAttribute("aria-level", "3");
    heading.textContent = title;
    const row = window.L.DomUtil.create("div", "ui-emoji-picker-row", this.grid);
    for (const emoji of emojis) {
      const btn = window.L.DomUtil.create("button", "ui-emoji-picker-cell", row);
      btn.type = "button";
      btn.textContent = emoji;
      btn.setAttribute("aria-label", this.firstKeyword(emoji) || emoji);
      btn.addEventListener("click", () => this.onPick(emoji));
    }
  }
  matchesEntry(entry) {
    if (!this.query)
      return true;
    return entry.e === this.query || entry.k.indexOf(this.query) !== -1;
  }
  renderGrid() {
    this.grid.replaceChildren();
    if (!this.query && this.recents.length > 0) {
      this.appendSection(_("Recently used"), this.recents);
    }
    let anyShown = false;
    for (const cat of _EmojiPickerWidget.CATEGORIES) {
      const filtered = this.query ? cat.emojis.filter((entry) => this.matchesEntry(entry)) : cat.emojis;
      if (filtered.length === 0)
        continue;
      anyShown = true;
      this.appendSection(cat.label, filtered.map((entry) => entry.e));
    }
    if (!anyShown && this.query) {
      const empty = window.L.DomUtil.create("div", "ui-emoji-picker-empty", this.grid);
      empty.textContent = _('No emojis match "{0}"').replace("{0}", this.query);
    }
  }
  build() {
    this.loadRecents();
    this.container = window.L.DomUtil.create("div", "ui-emoji-picker " + this.builder.options.cssClass, this.parentContainer);
    this.container.id = this.data.id;
    this.container.setAttribute("role", "dialog");
    if (this.data.aria && this.data.aria.label) {
      this.container.setAttribute("aria-label", this.data.aria.label);
    } else {
      this.container.setAttribute("aria-label", _("Choose an emoji"));
    }
    this.search = window.L.DomUtil.create("input", "ui-emoji-picker-search " + this.builder.options.cssClass, this.container);
    this.search.type = "search";
    this.search.placeholder = this.data.searchPlaceholder || _("Search emojis");
    this.search.setAttribute("aria-label", this.search.placeholder);
    this.search.addEventListener("input", () => {
      this.query = this.search.value.trim().toLowerCase();
      this.renderGrid();
    });
    this.grid = window.L.DomUtil.create("div", "ui-emoji-picker-grid", this.container);
    this.renderGrid();
    requestAnimationFrame(() => this.search.focus());
    return false;
  }
};
_EmojiPickerWidget.DEFAULT_RECENTS_KEY = "emojiPickerRecents";
_EmojiPickerWidget.DEFAULT_MAX_RECENTS = 16;
_EmojiPickerWidget.CATEGORIES = [
  {
    id: "smileys",
    label: _("Smileys"),
    emojis: [
      { e: "\u{1F60A}", k: "smile happy blush" },
      { e: "\u{1F600}", k: "grin smile happy face" },
      { e: "\u{1F601}", k: "grin smile happy beam" },
      { e: "\u{1F602}", k: "laugh cry tears joy lol" },
      { e: "\u{1F923}", k: "rofl laugh roll floor" },
      { e: "\u{1F605}", k: "sweat smile relief nervous" },
      { e: "\u{1F609}", k: "wink flirt" },
      { e: "\u{1F60D}", k: "love heart eyes adore" },
      { e: "\u{1F970}", k: "love hearts smile adore" },
      { e: "\u{1F618}", k: "kiss love" },
      { e: "\u{1F60E}", k: "cool sunglasses shades" },
      { e: "\u{1F929}", k: "star eyes excited wow" },
      { e: "\u{1F914}", k: "think thinking hmm" },
      { e: "\u{1F60F}", k: "smirk sly" },
      { e: "\u{1F60C}", k: "relieved calm content" },
      { e: "\u{1F634}", k: "sleep tired zzz" },
      { e: "\u{1F924}", k: "drool yum food" },
      { e: "\u{1F643}", k: "upside down silly" },
      { e: "\u{1FAE0}", k: "melt melting overwhelmed" },
      { e: "\u{1F607}", k: "angel halo innocent" },
      { e: "\u{1F973}", k: "party celebrate birthday" },
      { e: "\u{1F97A}", k: "pleading please beg" },
      { e: "\u{1F622}", k: "cry sad tear" },
      { e: "\u{1F62D}", k: "sob cry sad loud" },
      { e: "\u{1F624}", k: "huff steam frustrated" },
      { e: "\u{1F621}", k: "angry mad red" },
      { e: "\u{1F92C}", k: "angry swear curse" },
      { e: "\u{1F631}", k: "scream shock fear" },
      { e: "\u{1F976}", k: "cold freeze ice" },
      { e: "\u{1F975}", k: "hot sweat heat" },
      { e: "\u{1F92F}", k: "mind blown exploding" },
      { e: "\u{1F62C}", k: "grimace awkward" },
      { e: "\u{1F644}", k: "roll eyes annoyed" },
      { e: "\u{1F611}", k: "expressionless meh blank" },
      { e: "\u{1F610}", k: "neutral meh poker" },
      { e: "\u{1F636}", k: "silent no mouth blank" },
      { e: "\u{1F910}", k: "zip mouth quiet" },
      { e: "\u{1F92B}", k: "shh quiet hush" },
      { e: "\u{1F925}", k: "lying pinocchio" },
      { e: "\u{1F637}", k: "sick mask flu" }
    ]
  },
  {
    id: "people",
    label: _("People & gestures"),
    emojis: [
      { e: "\u{1F44B}", k: "wave hi hello bye" },
      { e: "\u{1F91D}", k: "handshake deal agreement" },
      { e: "\u{1F44D}", k: "thumbs up like yes good" },
      { e: "\u{1F44E}", k: "thumbs down dislike no bad" },
      { e: "\u{1F44F}", k: "clap applause bravo" },
      { e: "\u{1F64C}", k: "raise hands praise celebrate" },
      { e: "\u{1F64F}", k: "pray please thanks namaste" },
      { e: "\u{1F4AA}", k: "muscle strong flex" },
      { e: "\u270D\uFE0F", k: "write writing pen" },
      { e: "\u{1F91E}", k: "fingers crossed luck hope" },
      { e: "\u270C\uFE0F", k: "peace victory" },
      { e: "\u{1F918}", k: "rock metal horns" },
      { e: "\u{1F91F}", k: "love you sign hand" },
      { e: "\u{1F44C}", k: "ok okay perfect" },
      { e: "\u{1F90C}", k: "pinched fingers italian" },
      { e: "\u{1FAF0}", k: "finger heart love money" },
      { e: "\u{1FAF6}", k: "heart hands love" },
      { e: "\u{1FAE1}", k: "salute respect" },
      { e: "\u{1F932}", k: "open hands palms cup" },
      { e: "\u{1F440}", k: "eyes look watch see" },
      { e: "\u{1F9E0}", k: "brain smart mind think" },
      { e: "\u{1F476}", k: "baby infant" },
      { e: "\u{1F9D2}", k: "child kid" },
      { e: "\u{1F466}", k: "boy child" },
      { e: "\u{1F467}", k: "girl child" },
      { e: "\u{1F9D1}", k: "person adult" },
      { e: "\u{1F468}", k: "man male" },
      { e: "\u{1F469}", k: "woman female" },
      { e: "\u{1F9D3}", k: "older person elder" },
      { e: "\u{1F474}", k: "old man grandpa elder" }
    ]
  },
  {
    id: "objects",
    label: _("Objects"),
    emojis: [
      { e: "\u{1F4BC}", k: "briefcase work business job" },
      { e: "\u{1F4DD}", k: "note memo write document" },
      { e: "\u{1F4DA}", k: "books study library learn" },
      { e: "\u{1F4D6}", k: "book open read" },
      { e: "\u{1F4F0}", k: "newspaper news" },
      { e: "\u270F\uFE0F", k: "pencil write edit" },
      { e: "\u2712\uFE0F", k: "pen nib write ink" },
      { e: "\u{1F58A}\uFE0F", k: "pen write" },
      { e: "\u{1F58B}\uFE0F", k: "fountain pen write ink" },
      { e: "\u{1F4CC}", k: "pin pushpin" },
      { e: "\u{1F4CE}", k: "paperclip attach" },
      { e: "\u{1F587}\uFE0F", k: "paperclips link attach" },
      { e: "\u{1F4C2}", k: "folder open files" },
      { e: "\u{1F4C1}", k: "folder files" },
      { e: "\u{1F5C2}\uFE0F", k: "dividers organize files" },
      { e: "\u{1F4C5}", k: "calendar date day" },
      { e: "\u{1F4C6}", k: "calendar tear off date" },
      { e: "\u{1F5D2}\uFE0F", k: "spiral notepad notes" },
      { e: "\u{1F5D3}\uFE0F", k: "spiral calendar" },
      { e: "\u{1F4CA}", k: "bar chart stats data" },
      { e: "\u{1F4C8}", k: "chart up trending growth" },
      { e: "\u{1F4C9}", k: "chart down trending loss" },
      { e: "\u{1F4BB}", k: "laptop computer code" },
      { e: "\u{1F5A5}\uFE0F", k: "desktop computer monitor" },
      { e: "\u2328\uFE0F", k: "keyboard type" },
      { e: "\u{1F5B1}\uFE0F", k: "mouse computer click" },
      { e: "\u{1F5A8}\uFE0F", k: "printer print" },
      { e: "\u{1F4DE}", k: "phone call telephone" },
      { e: "\u{1F4F1}", k: "mobile phone cell smartphone" },
      { e: "\u{1F4BE}", k: "save floppy disk" },
      { e: "\u{1F4A1}", k: "idea bulb light" },
      { e: "\u{1F526}", k: "flashlight torch light" },
      { e: "\u{1F511}", k: "key lock" },
      { e: "\u{1F512}", k: "lock secure private" },
      { e: "\u{1F513}", k: "unlock open" },
      { e: "\u{1F528}", k: "hammer build tool" },
      { e: "\u{1F6E0}\uFE0F", k: "tools hammer wrench fix build" },
      { e: "\u2699\uFE0F", k: "gear settings config" },
      { e: "\u{1F9F0}", k: "toolbox tools" },
      { e: "\u23F0", k: "clock alarm time wake" }
    ]
  },
  {
    id: "symbols",
    label: _("Symbols"),
    emojis: [
      { e: "\u2728", k: "sparkles shine magic new" },
      { e: "\u2B50", k: "star favorite" },
      { e: "\u{1F31F}", k: "glowing star sparkle" },
      { e: "\u{1F4AB}", k: "dizzy stars sparkle" },
      { e: "\u{1F525}", k: "fire hot flame lit" },
      { e: "\u{1F4A5}", k: "boom explosion bang" },
      { e: "\u{1F4AF}", k: "hundred perfect best" },
      { e: "\u2705", k: "check tick yes done" },
      { e: "\u274C", k: "cross x no wrong" },
      { e: "\u26A0\uFE0F", k: "warning caution alert" },
      { e: "\u2757", k: "exclamation important" },
      { e: "\u2753", k: "question mark help" },
      { e: "\u{1F4AC}", k: "speech chat message bubble talk" },
      { e: "\u{1F4AD}", k: "thought bubble think" },
      { e: "\u{1F5E8}\uFE0F", k: "speech left bubble" },
      { e: "\u{1F5EF}\uFE0F", k: "anger right speech bubble" },
      { e: "\u2665\uFE0F", k: "heart love red" },
      { e: "\u{1F49C}", k: "purple heart" },
      { e: "\u{1F499}", k: "blue heart" },
      { e: "\u{1F49A}", k: "green heart" },
      { e: "\u{1F49B}", k: "yellow heart" },
      { e: "\u{1F9E1}", k: "orange heart" },
      { e: "\u{1F90D}", k: "white heart" },
      { e: "\u{1F90E}", k: "brown heart" },
      { e: "\u{1F5A4}", k: "black heart" },
      { e: "\u267B\uFE0F", k: "recycle reuse" },
      { e: "\u{1F197}", k: "ok button" },
      { e: "\u{1F195}", k: "new button" },
      { e: "\u{1F192}", k: "cool button" },
      { e: "\u{1F3AF}", k: "target bullseye dart goal aim" }
    ]
  },
  {
    id: "nature",
    label: _("Nature & food"),
    emojis: [
      { e: "\u{1F331}", k: "seedling plant grow" },
      { e: "\u{1F33F}", k: "herb leaf plant" },
      { e: "\u{1F340}", k: "four leaf clover luck" },
      { e: "\u{1F333}", k: "tree deciduous" },
      { e: "\u{1F332}", k: "evergreen tree pine" },
      { e: "\u{1F334}", k: "palm tree tropical" },
      { e: "\u{1F335}", k: "cactus desert" },
      { e: "\u{1F337}", k: "tulip flower" },
      { e: "\u{1F338}", k: "cherry blossom flower" },
      { e: "\u{1F339}", k: "rose flower red" },
      { e: "\u{1F33B}", k: "sunflower flower yellow" },
      { e: "\u{1F33C}", k: "blossom flower yellow" },
      { e: "\u{1F30D}", k: "earth globe europe africa" },
      { e: "\u{1F30E}", k: "earth globe americas" },
      { e: "\u{1F30F}", k: "earth globe asia australia" },
      { e: "\u2600\uFE0F", k: "sun sunny day" },
      { e: "\u{1F319}", k: "moon night crescent" },
      { e: "\u26C5", k: "cloud sun partly" },
      { e: "\u{1F327}\uFE0F", k: "rain cloud weather" },
      { e: "\u2744\uFE0F", k: "snowflake cold winter" },
      { e: "\u{1F34E}", k: "apple red fruit" },
      { e: "\u{1F34A}", k: "orange tangerine fruit" },
      { e: "\u{1F34B}", k: "lemon yellow fruit" },
      { e: "\u{1F34C}", k: "banana yellow fruit" },
      { e: "\u{1F349}", k: "watermelon fruit" },
      { e: "\u{1F347}", k: "grapes fruit" },
      { e: "\u{1F353}", k: "strawberry fruit red" },
      { e: "\u{1F352}", k: "cherries fruit red" },
      { e: "\u{1F355}", k: "pizza food" },
      { e: "\u{1F354}", k: "burger hamburger food" }
    ]
  }
];
let EmojiPickerWidget = _EmojiPickerWidget;
JSDialog.emojiPicker = function(parentContainer, data, builder, callback) {
  const widget = new EmojiPickerWidget(parentContainer, data, builder, callback);
  return widget.build();
};
