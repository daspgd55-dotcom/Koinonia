Add-Type -AssemblyName System.Drawing

$canvas=[System.Drawing.Bitmap]::new(1080,1350)
$g=[System.Drawing.Graphics]::FromImage($canvas)
$g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint=[System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#F5F6F2'))
$navy=[System.Drawing.ColorTranslator]::FromHtml('#061A34')
$teal=[System.Drawing.ColorTranslator]::FromHtml('#0F6664')
$gold=[System.Drawing.ColorTranslator]::FromHtml('#C99A4A')
$muted=[System.Drawing.ColorTranslator]::FromHtml('#66727A')
$line=[System.Drawing.ColorTranslator]::FromHtml('#DDE1DC')
$white=[System.Drawing.Color]::White
$bNavy=[System.Drawing.SolidBrush]::new($navy)
$bTeal=[System.Drawing.SolidBrush]::new($teal)
$bMuted=[System.Drawing.SolidBrush]::new($muted)
$bWhite=[System.Drawing.SolidBrush]::new($white)
$pBorder=[System.Drawing.Pen]::new($line,2)
$fontBrand=[System.Drawing.Font]::new('Georgia',26,[System.Drawing.FontStyle]::Regular)
$fontTiny=[System.Drawing.Font]::new('Segoe UI',19,[System.Drawing.FontStyle]::Bold)
$fontEyebrow=[System.Drawing.Font]::new('Segoe UI',21,[System.Drawing.FontStyle]::Bold)
$fontTitle=[System.Drawing.Font]::new('Georgia',46,[System.Drawing.FontStyle]::Regular)
$fontBody=[System.Drawing.Font]::new('Segoe UI',27,[System.Drawing.FontStyle]::Regular)
$fontName=[System.Drawing.Font]::new('Georgia',30,[System.Drawing.FontStyle]::Regular)
$fontMeta=[System.Drawing.Font]::new('Segoe UI',23,[System.Drawing.FontStyle]::Regular)
$fontFooter=[System.Drawing.Font]::new('Segoe UI',22,[System.Drawing.FontStyle]::Regular)

# Encabezado con el logo original de Koinonia.
$logoPath=[System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\Frontend\public\logo.png'))
$logo=[System.Drawing.Image]::FromFile($logoPath)
$g.FillRectangle($bWhite,72,42,70,70)
$g.DrawRectangle($pBorder,72,42,70,70)
$g.DrawImage($logo,80,50,54,54)
$g.DrawString('Koinonia',$fontBrand,$bNavy,160,44)
$g.DrawString('IGLESIAS PARA CONOCER',$fontTiny,$bTeal,162,80)
$g.DrawLine([System.Drawing.Pen]::new($gold,5),72,135,237,135)

# Texto del slide.
$g.DrawString('ANTES DE VISITAR',$fontEyebrow,$bTeal,78,175)
$g.DrawString('Prepara tu',$fontTitle,$bNavy,78,225)
$g.DrawString('primera visita',$fontTitle,$bNavy,78,282)
$g.FillRectangle([System.Drawing.SolidBrush]::new($gold),78,352,82,5)
$copy='Consulta horarios, cómo llegar, accesibilidad y qué esperar al llegar. Así puedes orientarte antes de salir.'
$copyFormat=[System.Drawing.StringFormat]::new()
$copyFormat.Trimming=[System.Drawing.StringTrimming]::Word
$copyFormat.FormatFlags=[System.Drawing.StringFormatFlags]::LineLimit
$copyRect=[System.Drawing.RectangleF]::new(78,395,350,310)
$g.DrawString($copy,$fontBody,$bMuted,$copyRect,$copyFormat)
$g.DrawString('IGLESIA DEL EJEMPLO',$fontTiny,$bTeal,78,785)
$g.DrawString('Senderos de Gracia',$fontName,$bNavy,78,825)
$g.DrawString('Providencia · Santiago',$fontMeta,$bMuted,78,870)

# Capturas recortadas de "Visítanos" y "Antes de venir".
$visitPath='C:\Users\david\Documents\python\Koinonia\.codex-attachments\6cf27aa3-608f-47a4-8845-f4bc3787d60d\864ae217-2798-458f-ba0f-70e5590e13ab\54767.jpg'
$visit=[System.Drawing.Bitmap]::new($visitPath)
$visitDest=[System.Drawing.Rectangle]::new(470,190,530,560)
$visitSrc=[System.Drawing.Rectangle]::new(25,200,530,560)
$g.FillRectangle($bWhite,$visitDest)
$g.DrawImage($visit,$visitDest,$visitSrc,[System.Drawing.GraphicsUnit]::Pixel)
$g.DrawRectangle($pBorder,$visitDest)

$beforePath='C:\Users\david\Documents\python\Koinonia\.codex-attachments\6cf27aa3-608f-47a4-8845-f4bc3787d60d\4a89296c-e169-4f9d-9711-519e581dafc8\54768.jpg'
$before=[System.Drawing.Bitmap]::new($beforePath)
$beforeDest=[System.Drawing.Rectangle]::new(470,770,530,440)
$beforeSrc=[System.Drawing.Rectangle]::new(25,395,530,530)
$g.FillRectangle($bWhite,$beforeDest)
$g.DrawImage($before,$beforeDest,$beforeSrc,[System.Drawing.GraphicsUnit]::Pixel)
$g.DrawRectangle($pBorder,$beforeDest)

# Pie de la publicación.
$g.DrawLine($pBorder,72,1240,1008,1240)
$g.DrawString('koinoniapp.cl',$fontFooter,$bNavy,78,1263)
$g.DrawString('Desliza para conocer el perfil  →',$fontFooter,$bMuted,605,1263)

$outPath=Join-Path -Path $PSScriptRoot -ChildPath 'post-church-example-slide-06.png'
$canvas.Save($outPath,[System.Drawing.Imaging.ImageFormat]::Png)
$visit.Dispose();$before.Dispose();$logo.Dispose();$copyFormat.Dispose();$canvas.Dispose();$g.Dispose()
Write-Output $outPath
