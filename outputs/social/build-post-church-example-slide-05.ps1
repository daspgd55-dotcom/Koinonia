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
$g.DrawString('EVENTOS',$fontEyebrow,$bTeal,78,175)
$g.DrawString('Fechas para',$fontTitle,$bNavy,78,225)
$g.DrawString('reunirnos',$fontTitle,$bNavy,78,282)
$g.FillRectangle([System.Drawing.SolidBrush]::new($gold),78,352,82,5)
$copy='Consulta actividades próximas con su fecha, lugar, modalidad y detalles de participación.'
$copyFormat=[System.Drawing.StringFormat]::new()
$copyFormat.Trimming=[System.Drawing.StringTrimming]::Word
$copyFormat.FormatFlags=[System.Drawing.StringFormatFlags]::LineLimit
$copyRect=[System.Drawing.RectangleF]::new(78,395,350,310)
$g.DrawString($copy,$fontBody,$bMuted,$copyRect,$copyFormat)
$g.DrawString('IGLESIA DEL EJEMPLO',$fontTiny,$bTeal,78,785)
$g.DrawString('Senderos de Gracia',$fontName,$bNavy,78,825)
$g.DrawString('Providencia · Santiago',$fontMeta,$bMuted,78,870)

# Captura recortada para incluir afiche y datos principales del evento.
$eventPath='C:\Users\david\Documents\python\Koinonia\.codex-attachments\59cb8f9b-395e-4b7a-9b30-3603fde0b718\e76d3e38-6a7a-45af-acd7-ebf2e81418ba\54774.jpg'
$event=[System.Drawing.Bitmap]::new($eventPath)
$eventDest=[System.Drawing.Rectangle]::new(470,190,530,950)
$eventSrc=[System.Drawing.Rectangle]::new(25,220,530,950)
$g.FillRectangle($bWhite,$eventDest)
$g.DrawImage($event,$eventDest,$eventSrc,[System.Drawing.GraphicsUnit]::Pixel)
$g.DrawRectangle($pBorder,$eventDest)

# Pie de la publicación.
$g.DrawLine($pBorder,72,1240,1008,1240)
$g.DrawString('koinoniapp.cl',$fontFooter,$bNavy,78,1263)
$g.DrawString('Desliza para conocer el perfil  →',$fontFooter,$bMuted,605,1263)

$outPath=Join-Path -Path $PSScriptRoot -ChildPath 'post-church-example-slide-05.png'
$canvas.Save($outPath,[System.Drawing.Imaging.ImageFormat]::Png)
$event.Dispose();$logo.Dispose();$copyFormat.Dispose();$canvas.Dispose();$g.Dispose()
Write-Output $outPath
