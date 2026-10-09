const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const base = req.protocol + '://' + req.get('host');
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`
  );
});

module.exports = router;
