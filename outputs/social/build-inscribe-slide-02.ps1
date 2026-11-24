Add-Type -AssemblyName System.Drawing

$canvas = [System.Drawing.Bitmap]::new(1080, 1920)
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$ivory = [System.Drawing.ColorTranslator]::FromHtml('#F5F6F2')
$navy = [System.Drawing.ColorTranslator]::FromHtml('#061A34')
$teal = [System.Drawing.ColorTranslator]::FromHtml('#0F6664')
$gold = [System.Drawing.ColorTranslator]::FromHtml('#C99A4A')
$muted = [System.Drawing.ColorTranslator]::FromHtml('#66727A')
$line = [System.Drawing.ColorTranslator]::FromHtml('#DDE1DC')
$graphics.Clear($ivory)

$fontLabel = [System.Drawing.Font]::new('Segoe UI', 25, [System.Drawing.FontStyle]::Bold)
$fontTitle = [System.Drawing.Font]::new('Georgia', 68, [System.Drawing.FontStyle]::Regular)
$fontBody = [System.Drawing.Font]::new('Segoe UI', 30, [System.Drawing.FontStyle]::Regular)
$fontCaption = [System.Drawing.Font]::new('Segoe UI', 23, [System.Drawing.FontStyle]::Bold)
$fontFooter = [System.Drawing.Font]::new('Segoe UI', 23, [System.Drawing.FontStyle]::Regular)
$fontButton = [System.Drawing.Font]::new('Segoe UI', 25, [System.Drawing.FontStyle]::Bold)
$brushNavy = [System.Drawing.SolidBrush]::new($navy)
$brushTeal = [System.Drawing.SolidBrush]::new($teal)
$brushGold = [System.Drawing.SolidBrush]::new($gold)
$brushMuted = [System.Drawing.SolidBrush]::new($muted)
$brushWhite = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$penLine = [System.Drawing.Pen]::new($line, 2)

$graphics.DrawString('INSCRIBE TU IGLESIA · 02', $fontLabel, $brushTeal, 88, 65)
$graphics.FillRectangle($brushGold, 88, 112, 225, 7)
$graphics.DrawString('Completa la', $fontTitle, $brushNavy, 82, 145)
$graphics.DrawString('información', $fontTitle, $brushNavy, 82, 224)
$graphics.DrawString('Cuéntanos sobre la iglesia y quién presenta', $fontBody, $brushMuted, 88, 317)
$graphics.DrawString('la solicitud.', $fontBody, $brushMuted, 88, 359)

$churchPath = 'C:\Users\david\AppData\Local\Temp\codex-clipboard-5e271597-8587-48d0-b036-829f542b0e8c.png'
$contactPath = 'C:\Users\david\AppData\Local\Temp\codex-clipboard-ea57fe5f-645e-4417-b92d-169977640ef3.png'
$church = [System.Drawing.Image]::FromFile($churchPath)
$contact = [System.Drawing.Image]::FromFile($contactPath)

$graphics.DrawString('DATOS DE LA IGLESIA', $fontCaption, $brushTeal, 115, 405)
$churchDest = [System.Drawing.Rectangle]::new(115, 442, 850, 485)
$churchCrop = [System.Drawing.Rectangle]::new(2, 0, 998, 570)
$graphics.DrawImage($church, $churchDest, $churchCrop, [System.Drawing.GraphicsUnit]::Pixel)

$graphics.DrawString('PERSONA DE CONTACTO', $fontCaption, $brushTeal, 115, 947)
$contactDest = [System.Drawing.Rectangle]::new(115, 992, 850, 431)
$contactCrop = [System.Drawing.Rectangle]::new(0, 0, 985, 500)
$graphics.DrawImage($contact, $contactDest, $contactCrop, [System.Drawing.GraphicsUnit]::Pixel)

$graphics.DrawLine($penLine, 88, 1465, 992, 1465)
$graphics.DrawString('Revisa ese correo para confirmar la solicitud', $fontFooter, $brushNavy, 88, 1485)
$graphics.DrawString('y seguir su avance.', $fontFooter, $brushNavy, 88, 1523)
$graphics.FillRectangle($brushTeal, 770, 1572, 222, 70)
$graphics.DrawString('Sigue  →', $fontButton, $brushWhite, 801, 1585)

$outPath = Join-Path $PSScriptRoot 'inscribe-slide-02.png'
$canvas.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$church.Dispose()
$contact.Dispose()
$graphics.Dispose()
$canvas.Dispose()
Write-Output $outPath
