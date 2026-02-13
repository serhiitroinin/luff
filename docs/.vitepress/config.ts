import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Luff",
  description: "CLI tools for life management",
  base: "/luff/",

  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/luff/logo.svg" }],
  ],

  themeConfig: {
    logo: "/logo.svg",

    nav: [
      { text: "Getting Started", link: "/getting-started" },
      {
        text: "Tools",
        items: [
          { text: "todo", link: "/tools/todo" },
          { text: "cal", link: "/tools/cal" },
          { text: "mail", link: "/tools/mail" },
          { text: "whoop", link: "/tools/whoop" },
          { text: "garmin", link: "/tools/garmin" },
          { text: "libre", link: "/tools/libre" },
          { text: "rescuetime", link: "/tools/rescuetime" },
        ],
      },
      {
        text: "Guide",
        items: [
          { text: "Authentication", link: "/guide/authentication" },
          { text: "Multi-Account", link: "/guide/multi-account" },
        ],
      },
      { text: "Architecture", link: "/reference/architecture" },
    ],

    sidebar: {
      "/tools/": [
        {
          text: "Tools",
          items: [
            { text: "todo", link: "/tools/todo" },
            { text: "cal", link: "/tools/cal" },
            { text: "mail", link: "/tools/mail" },
            { text: "whoop", link: "/tools/whoop" },
            { text: "garmin", link: "/tools/garmin" },
            { text: "libre", link: "/tools/libre" },
            { text: "rescuetime", link: "/tools/rescuetime" },
          ],
        },
      ],
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "Authentication", link: "/guide/authentication" },
            { text: "Multi-Account", link: "/guide/multi-account" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "Reference",
          items: [
            { text: "Architecture", link: "/reference/architecture" },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/serhiitroinin/luff" },
    ],

    search: {
      provider: "local",
    },

    footer: {
      message: "Released under the MIT License.",
    },
  },
});
