Add-Type -AssemblyName System.Drawing

$canvas = [System.Drawing.Bitmap]::new(1080, 1920)
$g = [System.Drawing.Graphics]::FromImage($canvas)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$ivory = [System.Drawing.ColorTranslator]::FromHtml('#F5F6F2')
$navy = [System.Drawing.ColorTranslator]::FromHtml('#061A34')
$teal = [System.Drawing.ColorTranslator]::FromHtml('#0F6664')
$gold = [System.Drawing.ColorTranslator]::FromHtml('#C99A4A')
$muted = [System.Drawing.ColorTranslator]::FromHtml('#66727A')
$line = [System.Drawing.ColorTranslator]::FromHtml('#DDE1DC')
$g.Clear($ivory)

$fontLabel = [System.Drawing.Font]::new('Segoe UI', 25, [System.Drawing.FontStyle]::Bold)
$fontTitle = [System.Drawing.Font]::new('Georgia', 64, [System.Drawing.FontStyle]::Regular)
$fontBody = [System.Drawing.Font]::new('Segoe UI', 28, [System.Drawing.FontStyle]::Regular)
$fontCaption = [System.Drawing.Font]::new('Segoe UI', 23, [System.Drawing.FontStyle]::Bold)
$fontCalloutTitle = [System.Drawing.Font]::new('Georgia', 35, [System.Drawing.FontStyle]::Regular)
$fontFooter = [System.Drawing.Font]::new('Segoe UI', 26, [System.Drawing.FontStyle]::Regular)
$fontButton = [System.Drawing.Font]::new('Segoe UI', 25, [System.Drawing.FontStyle]::Bold)
$brushNavy = [System.Drawing.SolidBrush]::new($navy)
$brushTeal = [System.Drawing.SolidBrush]::new($teal)
$brushGold = [System.Drawing.SolidBrush]::new($gold)
$brushMuted = [System.Drawing.SolidBrush]::new($muted)
$brushWhite = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$brushCard = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#FAFBF8'))
$brushScreenText = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#66727A'))
$fontScreenText = [System.Drawing.Font]::new('Segoe UI', 14, [System.Drawing.FontStyle]::Regular)
$penLine = [System.Drawing.Pen]::new($line, 2)

$g.DrawString('INSCRIBE TU IGLESIA · 03', $fontLabel, $brushTeal, 88, 70)
$g.FillRectangle($brushGold, 88, 118, 225, 7)
$g.DrawString('Un equipo para', $fontTitle, $brushNavy, 82, 146)
$g.DrawString('cuidar la información', $fontTitle, $brushNavy, 82, 220)
$g.DrawString('Puedes incluirte o sumar personas y proponer', $fontBody, $brushMuted, 88, 303)
$g.DrawString('la función de cada una.', $fontBody, $brushMuted, 88, 343)
$g.DrawString('PERSONAS Y FUNCIONES', $fontCaption, $brushTeal, 115, 408)

$screenPath = 'C:\Users\david\AppData\Local\Temp\codex-clipboard-93dc55fe-13b7-40f7-a406-56ce5769bdb2.png'
$screen = [System.Drawing.Bitmap]::new($screenPath)
$sg = [System.Drawing.Graphics]::FromImage($screen)
$sg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$emailFont = [System.Drawing.Font]::new('Segoe UI', 16, [System.Drawing.FontStyle]::Regular)
$emailBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#17232D'))
$inputFill = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$sg.FillRectangle($inputFill, 46, 344, 265, 34)
$sg.DrawString('representante@iglesia.cl', $emailFont, $emailBrush, 49, 350)
$sg.FillRectangle($brushCard, 29, 540, 305, 32)
$sg.DrawString('Puede administrar la iglesia.', $fontScreenText, $brushScreenText, 31, 547)
$sg.Dispose()

$dest = [System.Drawing.Rectangle]::new(90, 445, 900, 475)
$crop = [System.Drawing.Rectangle]::new(8, 112, 918, 484)
$g.DrawImage($screen, $dest, $crop, [System.Drawing.GraphicsUnit]::Pixel)

$callout = [System.Drawing.Rectangle]::new(88, 970, 904, 250)
$g.FillRectangle([System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#E8F1ED')), $callout)
$g.FillRectangle($brushGold, 88, 970, 8, 250)
$g.DrawString('Mantenerla al día importa', $fontCalloutTitle, $brushNavy, 126, 1000)
$g.DrawString('Un equipo responsable ayuda a que quienes buscan', $fontBody, $brushMuted, 126, 1067)
$g.DrawString('una iglesia encuentren información completa', $fontBody, $brushMuted, 126, 1108)
$g.DrawString('y actualizada.', $fontBody, $brushMuted, 126, 1149)

$g.DrawLine($penLine, 88, 1290, 992, 1290)
$g.DrawString('Las funciones propuestas se revisan antes', $fontFooter, $brushNavy, 88, 1320)
$g.DrawString('de habilitar accesos.', $fontFooter, $brushNavy, 88, 1358)
$g.FillRectangle($brushTeal, 770, 1572, 222, 70)
$g.DrawString('Sigue  →', $fontButton, $brushWhite, 801, 1585)

$outPath = Join-Path $PSScriptRoot 'inscribe-slide-03.png'
$canvas.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$screen.Dispose()
$canvas.Dispose()
$g.Dispose()
Write-Output $outPath
