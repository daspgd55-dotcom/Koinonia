Add-Type -AssemblyName System.Drawing

$canvas=[System.Drawing.Bitmap]::new(1080,1350)
$g=[System.Drawing.Graphics]::FromImage($canvas)
$g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint=[System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$bg=[System.Drawing.ColorTranslator]::FromHtml('#F5F6F2')
$navy=[System.Drawing.ColorTranslator]::FromHtml('#061A34')
$teal=[System.Drawing.ColorTranslator]::FromHtml('#0F6664')
$gold=[System.Drawing.ColorTranslator]::FromHtml('#C99A4A')
$muted=[System.Drawing.ColorTranslator]::FromHtml('#66727A')
$line=[System.Drawing.ColorTranslator]::FromHtml('#DDE1DC')
$white=[System.Drawing.Color]::White
$g.Clear($bg)

$fontBrand=[System.Drawing.Font]::new('Georgia',26,[System.Drawing.FontStyle]::Regular)
$fontTiny=[System.Drawing.Font]::new('Segoe UI',19,[System.Drawing.FontStyle]::Bold)
$fontEyebrow=[System.Drawing.Font]::new('Segoe UI',21,[System.Drawing.FontStyle]::Bold)
$fontTitle=[System.Drawing.Font]::new('Georgia',46,[System.Drawing.FontStyle]::Regular)
$fontBody=[System.Drawing.Font]::new('Segoe UI',27,[System.Drawing.FontStyle]::Regular)
$fontName=[System.Drawing.Font]::new('Georgia',30,[System.Drawing.FontStyle]::Regular)
$fontMeta=[System.Drawing.Font]::new('Segoe UI',23,[System.Drawing.FontStyle]::Regular)
$fontFooter=[System.Drawing.Font]::new('Segoe UI',22,[System.Drawing.FontStyle]::Regular)
$bNavy=[System.Drawing.SolidBrush]::new($navy)
$bTeal=[System.Drawing.SolidBrush]::new($teal)
$bGold=[System.Drawing.SolidBrush]::new($gold)
$bMuted=[System.Drawing.SolidBrush]::new($muted)
$bWhite=[System.Drawing.SolidBrush]::new($white)
$pBorder=[System.Drawing.Pen]::new($line,2)
$pGold=[System.Drawing.Pen]::new($gold,5)

# Brand header with the original Koinonia asset.
$logoPath=[System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\Frontend\public\logo.png'))
$logo=[System.Drawing.Image]::FromFile($logoPath)
$g.FillRectangle($bWhite,72,42,70,70)
$g.DrawRectangle($pBorder,72,42,70,70)
$g.DrawImage($logo,80,50,54,54)
$g.DrawString('Koinonia',$fontBrand,$bNavy,160,44)
$g.DrawString('IGLESIAS PARA CONOCER',$fontTiny,$bTeal,162,80)
$g.DrawLine($pGold,72,135,237,135)

# Presentation copy.
$g.DrawString('PERFIL DE EJEMPLO',$fontEyebrow,$bTeal,78,175)
$g.DrawString('Así se ve',$fontTitle,$bNavy,78,215)
$g.DrawString('una iglesia',$fontTitle,$bNavy,78,272)
$g.DrawString('en Koinonia',$fontTitle,$bNavy,78,329)
$g.FillRectangle($bGold,78,393,82,5)
$body='Un perfil de ejemplo que reúne identidad, comunidad y datos útiles para una visita.'
$bodyFormat=[System.Drawing.StringFormat]::new()
$bodyFormat.Trimming=[System.Drawing.StringTrimming]::Word
$bodyFormat.FormatFlags=[System.Drawing.StringFormatFlags]::LineLimit
$bodyRect=[System.Drawing.RectangleF]::new(78,430,350,340)
$g.DrawString($body,$fontBody,$bMuted,$bodyRect,$bodyFormat)
$g.DrawString('IGLESIA DEL EJEMPLO',$fontTiny,$bTeal,78,790)
$g.DrawString('Senderos de Gracia',$fontName,$bNavy,78,830)
$g.DrawString('Providencia · Santiago',$fontMeta,$bMuted,78,875)

# Crop to the profile identity and its banner, removing phone status and browser chrome.
$sourcePath='C:\Users\david\Documents\python\Koinonia\.codex-attachments\6cf27aa3-608f-47a4-8845-f4bc3787d60d\635118f5-b786-4f6b-af75-56d5f3e2161f\54764.jpg'
$screen=[System.Drawing.Bitmap]::new($sourcePath)
$identityBox=[System.Drawing.Rectangle]::new(450,265,550,237)
$identitySource=[System.Drawing.Rectangle]::new(25,289,525,226)
$bannerBox=[System.Drawing.Rectangle]::new(450,522,550,310)
$bannerSource=[System.Drawing.Rectangle]::new(52,762,470,265)
$g.FillRectangle($bWhite,$identityBox);$g.DrawRectangle($pBorder,$identityBox)
$g.DrawImage($screen,$identityBox,$identitySource,[System.Drawing.GraphicsUnit]::Pixel)
$g.FillRectangle($bWhite,$bannerBox);$g.DrawRectangle($pBorder,$bannerBox)
$g.DrawImage($screen,$bannerBox,$bannerSource,[System.Drawing.GraphicsUnit]::Pixel)

# Reusable carousel footer.
$g.DrawLine($pBorder,72,1240,1008,1240)
$g.DrawString('koinoniapp.cl',$fontFooter,$bNavy,78,1263)
$g.DrawString('Desliza para conocer el perfil  →',$fontFooter,$bMuted,605,1263)

$outPath=Join-Path $PSScriptRoot 'post-church-example-slide-01.png'
$canvas.Save($outPath,[System.Drawing.Imaging.ImageFormat]::Png)
$screen.Dispose();$logo.Dispose();$bodyFormat.Dispose();$canvas.Dispose();$g.Dispose()
Write-Output $outPath
