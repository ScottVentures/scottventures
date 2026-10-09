# ScottIMG

ScottIMG is a separate image-tools site inside the PDFTools project. It has its own home page and API and does not change ScottPDF. The layout takes inspiration from the public iLoveIMG home page, with ScottIMG branding and original code/assets.

## Start

From PowerShell, run `.ScottIMGun_scottimg.ps1` in the PDFTools folder, or run `.un_scottimg.ps1` from this folder. The site opens at <http://127.0.0.1:8001>; API documentation is at `/api/docs`.

The local Pillow backend handles one image per run: compression, resizing, cropping, format conversion, rotation, basic color enhancement, text watermarking, meme captions, enlarging, solid-color background transparency, and rectangular blur. Upscale uses conventional resampling rather than an AI restoration model. Background removal works on a flat color using a color tolerance; blur uses a manually selected rectangle and does not detect faces. HTML-to-image webpage rendering requires a browser capture engine and currently reports that limitation instead of returning a misleading result. The AI background removal and AI upscale offered by some online services are not implemented here.
