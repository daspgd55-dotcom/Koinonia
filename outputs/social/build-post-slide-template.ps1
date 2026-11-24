Add-Type -AssemblyName System.Drawing

$canvas=[System.Drawing.Bitmap]::new(1080,1350)
$g=[System.Drawing.Graphics]::FromImage($canvas)
$g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint=[System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#F5F6F2'))

$navy=[System.Drawing.ColorTranslator]::FromHtml('#061A34')
$teal=[System.Drawing.ColorTranslator]::FromHtml('#0F6664')
$gold=[System.Drawing.ColorTranslator]::FromHtml('#C99A4A')
$muted=[System.Drawing.ColorTranslator]::FromHtml('#66727A')
$line=[System.Drawing.ColorTranslator]::FromHtml('#DDE1DC')
$pale=[System.Drawing.ColorTranslator]::FromHtml('#E8F1ED')
$white=[System.Drawing.Color]::White
$bNavy=[System.Drawing.SolidBrush]::new($navy)
$bTeal=[System.Drawing.SolidBrush]::new($teal)
$bGold=[System.Drawing.SolidBrush]::new($gold)
$bMuted=[System.Drawing.SolidBrush]::new($muted)
$bLine=[System.Drawing.SolidBrush]::new($line)
$bPale=[System.Drawing.SolidBrush]::new($pale)
$bWhite=[System.Drawing.SolidBrush]::new($white)
$pBorder=[System.Drawing.Pen]::new($line,2)
$pTeal=[System.Drawing.Pen]::new($teal,5)
$pMuted=[System.Drawing.Pen]::new($muted,3)
$fontBrand=[System.Drawing.Font]::new('Georgia',26,[System.Drawing.FontStyle]::Regular)
$fontTiny=[System.Drawing.Font]::new('Segoe UI',17,[System.Drawing.FontStyle]::Bold)
$fontEyebrow=[System.Drawing.Font]::new('Segoe UI',21,[System.Drawing.FontStyle]::Bold)
$fontTitle=[System.Drawing.Font]::new('Georgia',55,[System.Drawing.FontStyle]::Regular)
$fontBody=[System.Drawing.Font]::new('Segoe UI',29,[System.Drawing.FontStyle]::Regular)
$fontPlaceholder=[System.Drawing.Font]::new('Segoe UI',25,[System.Drawing.FontStyle]::Regular)
$fontFooter=[System.Drawing.Font]::new('Segoe UI',23,[System.Drawing.FontStyle]::Regular)

# Header with the exact Koinonia logo asset.
$logoPath=Join-Path $PSScriptRoot '..\..\Frontend\public\logo.png'
$logoPath=[System.IO.Path]::GetFullPath($logoPath)
$logo=[System.Drawing.Image]::FromFile($logoPath)
$header=[System.Drawing.Rectangle]::new(72,42,70,70)
$g.FillRectangle($bWhite,$header)
$g.DrawRectangle($pBorder,$header)
$g.DrawImage($logo,80,50,54,54)
$g.DrawString('Koinonia',$fontBrand,$bNavy,160,44)
$g.DrawString('IGLESIAS PARA CONOCER',$fontTiny,$bTeal,162,80)
$g.FillRectangle($bGold,72,135,165,6)

# Text area: flexible enough for a short title and a compact explanatory paragraph.
$g.DrawString('TEMA / SECCIÓN',$fontEyebrow,$bTeal,78,175)
$titleRect=[System.Drawing.RectangleF]::new(76,225,430,220)
$titleFormat=[System.Drawing.StringFormat]::new()
$titleFormat.Trimming=[System.Drawing.StringTrimming]::Word
$titleFormat.FormatFlags=[System.Drawing.StringFormatFlags]::LineLimit
$g.DrawString('Título breve del slide',$fontTitle,$bNavy,$titleRect,$titleFormat)
$g.FillRectangle($bGold,78,457,82,5)
$bodyRect=[System.Drawing.RectangleF]::new(78,500,395,385)
$bodyFormat=[System.Drawing.StringFormat]::new()
$bodyFormat.Trimming=[System.Drawing.StringTrimming]::Word
$bodyFormat.FormatFlags=[System.Drawing.StringFormatFlags]::LineLimit
$g.DrawString('Añade aquí una explicación corta que complemente la captura. Prioriza una idea principal y deja espacio para leerla con comodidad.',$fontBody,$bMuted,$bodyRect,$bodyFormat)

# Optional short supporting label in a soft teal pill.
$pill=[System.Drawing.Rectangle]::new(78,915,395,72)
$g.FillRectangle($bPale,$pill)
$g.DrawString('DATO O IDEA DESTACADA',$fontTiny,$bTeal,104,938)

# Tall media slot follows the portrait proportions of the app captures.
$media=[System.Drawing.Rectangle]::new(520,190,480,1000)
$g.FillRectangle($bWhite,$media)
$g.DrawRectangle($pBorder,$media)
$inner=[System.Drawing.Rectangle]::new(536,206,448,968)
$g.FillRectangle($bPale,$inner)
$g.DrawRectangle($pBorder,$inner)
$g.DrawRectangle($pMuted,664,505,192,142)
$g.DrawLine($pMuted,664,647,856,505)
$g.DrawEllipse($pTeal,722,545,52,52)
$g.DrawString('CAPTURA DE LA IGLESIA',$fontTiny,$bTeal,616,696)
$g.DrawString('Imagen vertical',$fontPlaceholder,$bMuted,650,738)

# Reusable footer.
$g.DrawLine($pBorder,72,1240,1008,1240)
$g.DrawString('koinoniapp.cl',$fontFooter,$bNavy,78,1263)
$g.DrawString('IGLESIAS EN KOINONIA',$fontTiny,$bMuted,785,1271)

$outPath=Join-Path $PSScriptRoot 'post-slide-template.png'
$canvas.Save($outPath,[System.Drawing.Imaging.ImageFormat]::Png)
$logo.Dispose();$titleFormat.Dispose();$bodyFormat.Dispose();$canvas.Dispose();$g.Dispose()
Write-Output $outPath
