// search-data.js — a small static index of every article, used by
// search.js to power the site search overlay. Kept as a plain JS
// array (not fetched from an API) since there are only a handful of
// articles and it saves a network round-trip.
var SV_SEARCH_INDEX = [
  { title: "Unleashing Your Creativity: Tapping into the Well of Imagination", desc: "Uncover strategies to ignite your creative spark, foster innovation, and overcome creative blocks.", href: "Articles/article1.html" },
  { title: "The Science of Effective Learning: Strategies for Retaining Information and Boosting Memory", desc: "Explore evidence-based learning techniques, memory-enhancement strategies, and cognitive principles that boost retention.", href: "Articles/article2.html" },
  { title: "Understanding File Permissions Without the Confusion", desc: "What rwx and those three number groups actually mean, and how to stop guessing with chmod.", href: "Articles/file-permissions.html" },
  { title: "Git Aliases You Didn't Know You Needed", desc: "Turn three-word Git commands into two keystrokes with aliases you can copy straight into your .gitconfig.", href: "Articles/git.html" },
  { title: "Understanding the Motherboard: A 5-Minute Tour", desc: "Chipset, VRMs, and the traces connecting them — a map of the board you're probably staring at right now.", href: "Articles/motherboard.html" },
  { title: "What Actually Happens When You Press the Power Button", desc: "POST, BIOS handoff, and the half-second chain of events before you ever see a logo, walked through step by step.", href: "Articles/power-button.html" },
  { title: "Regex, Explained Without the Headache", desc: "The six regex symbols that cover 90% of what you'll ever need to match, with real examples.", href: "Articles/regex.html" },
  { title: "What a Router Actually Does, in Plain English", desc: "Packets, NAT, and why your devices all share one IP address to the outside world.", href: "Articles/router-basics.html" },
  { title: "SATA vs NVMe: Why Your SSD Choice Actually Matters", desc: "The physical difference between SATA and NVMe drives, and when the upgrade is actually worth it.", href: "Articles/sata-vs-nvme.html" },
  { title: "5 Terminal Tricks That'll Save You Hours", desc: "Reverse search, brace expansion, and terminal aliases you'll wonder how you lived without.", href: "Articles/terminal-tricks.html" },
  { title: "Two-Factor Auth: What It's Actually Protecting You From", desc: "The difference between SMS codes and authenticator apps, and which one you should actually use.", href: "Articles/two-factor-auth.html" },
  { title: "Mastering Web App Development with Angular", desc: "A hands-on Angular tutorial covering components, data binding, routing, and deployment.", href: "Tutorials/angular.html" },
  { title: "Mastering React", desc: "A practical introduction to React — components, state, effects, and the mistakes that trip up beginners.", href: "Tutorials/react-basics.html" },
  { title: "Data Structures Demystified", desc: "Arrays, hash maps, linked lists, stacks, queues, and trees — what each one actually trades off.", href: "Tutorials/data-structures.html" },
  { title: "Building RESTful APIs with Django", desc: "A hands-on walkthrough of Django REST Framework — models, serializers, viewsets, and permissions.", href: "Tutorials/django-rest-api.html" },
  { title: "The Complete Web Developer's Handbook", desc: "How HTML, CSS, and JavaScript actually fit together — the box model, layout systems, and DOM mistakes.", href: "Materials/web-developers-handbook.html" },
  { title: "Deep Learning: Neural Networks and AI Applications", desc: "How neural networks actually learn — layers, backpropagation, and convolutional/recurrent architectures.", href: "Materials/deep-learning.html" },
  { title: "Secure Coding: Building Robust Systems", desc: "Defensive coding practices that close most real-world vulnerabilities: injection, XSS, and more.", href: "Materials/secure-coding.html" },
  { title: "Databases 101", desc: "Relational database fundamentals — tables, keys, joins, indexes, and normalization tradeoffs.", href: "Materials/databases-101.html" },
  { title: "Cloud Fundamentals", desc: "What the cloud actually is, IaaS vs PaaS vs SaaS, scaling strategies, and containers.", href: "Materials/cloud-fundamentals.html" },
  { title: "Version Control Beyond the Basics", desc: "Branching strategies compared — feature branching, trunk-based development, rebase vs. merge.", href: "Materials/version-control.html" },
  { title: "Community Forum", desc: "Discuss articles, ask questions, and share what you're building with the ScottVentures community.", href: "forum.html" }
];
