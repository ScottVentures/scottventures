// Central catalog of every tool ScottImg offers. Adding a working tool is:
// (1) build the page component, (2) set `status: 'ready'` and `path` here.
// Everything else stays 'soon' and renders through the shared ComingSoon
// page, so the hub always shows the full breadth of what ScottImg does
// without ever claiming a tool works before it actually does.

export const CATEGORIES = [
  'Optimize',
  'Create',
  'Modify',
  'Convert',
  'Security',
];

export const TOOLS = [
  // ---- Optimize -----------------------------------------------------
  { id: 'compress', name: 'Compress IMAGE', category: 'Optimize', icon: 'compress',
    blurb: 'Shrink JPG, PNG and WEBP images while keeping the best possible quality.',
    status: 'ready', path: '/compress' },
  { id: 'upscale', name: 'Upscale Image', category: 'Optimize', icon: 'upscale',
    blurb: 'Enlarge a photo and sharpen its edges with AI, with no pixelation.',
    status: 'soon' },
  { id: 'removebg', name: 'Remove background', category: 'Optimize', icon: 'removebg',
    blurb: 'Cut a subject out automatically and export it on a transparent background.',
    status: 'soon' },

  // ---- Create ---------------------------------------------------------
  { id: 'meme', name: 'Meme generator', category: 'Create', icon: 'meme',
    blurb: 'Drop bold top/bottom captions onto any image and download it instantly.',
    status: 'ready', path: '/meme' },
  { id: 'editor', name: 'Photo editor', category: 'Create', icon: 'editor',
    blurb: 'Adjust brightness, contrast and filters, then crop and touch up a photo.',
    status: 'soon' },

  // ---- Modify -----------------------------------------------------------
  { id: 'resize', name: 'Resize IMAGE', category: 'Modify', icon: 'resize',
    blurb: 'Change an image’s pixel dimensions by exact size or percentage.',
    status: 'ready', path: '/resize' },
  { id: 'crop', name: 'Crop IMAGE', category: 'Modify', icon: 'crop',
    blurb: 'Trim an image down to just the part you want, with a live preview.',
    status: 'ready', path: '/crop' },
  { id: 'rotate', name: 'Rotate IMAGE', category: 'Modify', icon: 'rotate',
    blurb: 'Rotate or flip one image, or a whole batch, in a couple of clicks.',
    status: 'ready', path: '/rotate' },

  // ---- Convert ------------------------------------------------------------
  { id: 'to-jpg', name: 'Convert to JPG', category: 'Convert', icon: 'convert',
    blurb: 'Turn PNG, WEBP, GIF, BMP and more into JPG images.',
    status: 'ready', path: '/to-jpg' },
  { id: 'from-jpg', name: 'Convert from JPG', category: 'Convert', icon: 'convert',
    blurb: 'Turn a JPG photo into PNG or WEBP format.',
    status: 'ready', path: '/from-jpg' },
  { id: 'html-to-image', name: 'HTML to IMAGE', category: 'Convert', icon: 'htmlimg',
    blurb: 'Capture any web page as a full-page image by pasting in its URL.',
    status: 'soon' },

  // ---- Security -----------------------------------------------------------
  { id: 'watermark', name: 'Watermark IMAGE', category: 'Security', icon: 'watermark',
    blurb: 'Stamp text or a logo across one image or a whole batch at once.',
    status: 'ready', path: '/watermark' },
  { id: 'blurface', name: 'Blur face', category: 'Security', icon: 'blurface',
    blurb: 'Automatically detect and blur faces to protect people’s privacy.',
    status: 'soon' },
];

export const toolById = (id) => TOOLS.find((t) => t.id === id);
