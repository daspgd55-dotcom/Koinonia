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
$pale=[System.Drawing.ColorTranslator]::FromHtml('#E8F1ED')
$bNavy=[System.Drawing.SolidBrush]::new($navy)
$bTeal=[System.Drawing.SolidBrush]::new($teal)
$bMuted=[System.Drawing.SolidBrush]::new($muted)
$bWhite=[System.Drawing.SolidBrush]::new($white)
$bPale=[System.Drawing.SolidBrush]::new($pale)
$pBorder=[System.Drawing.Pen]::new($line,2)
$pGold=[System.Drawing.Pen]::new($gold,5)
$fontBrand=[System.Drawing.Font]::new('Georgia',26,[System.Drawing.FontStyle]::Regular)
$fontTiny=[System.Drawing.Font]::new('Segoe UI',19,[System.Drawing.FontStyle]::Bold)
$fontEyebrow=[System.Drawing.Font]::new('Segoe UI',21,[System.Drawing.FontStyle]::Bold)
$fontTitle=[System.Drawing.Font]::new('Georgia',40,[System.Drawing.FontStyle]::Regular)
$fontBody=[System.Drawing.Font]::new('Segoe UI',24,[System.Drawing.FontStyle]::Regular)
$fontCTA=[System.Drawing.Font]::new('Segoe UI',25,[System.Drawing.FontStyle]::Bold)
$fontFooter=[System.Drawing.Font]::new('Segoe UI',22,[System.Drawing.FontStyle]::Regular)

# Encabezado con el logo original de Koinonia.
$logoPath=[System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\Frontend\public\logo.png'))
$logo=[System.Drawing.Image]::FromFile($logoPath)
$g.FillRectangle($bWhite,72,42,70,70)
$g.DrawRectangle($pBorder,72,42,70,70)
$g.DrawImage($logo,80,50,54,54)
$g.DrawString('Koinonia',$fontBrand,$bNavy,160,44)
$g.DrawString('IGLESIAS PARA CONOCER',$fontTiny,$bTeal,162,80)
$g.DrawLine($pGold,72,135,237,135)

# Invitación final a las iglesias.
$g.DrawString('PARA IGLESIAS',$fontEyebrow,$bTeal,78,175)
$g.DrawString('Tu iglesia',$fontTitle,$bNavy,78,215)
$g.DrawString('también puede',$fontTitle,$bNavy,78,263)
$g.DrawString('darse a',$fontTitle,$bNavy,78,311)
$g.DrawString('conocer',$fontTitle,$bNavy,78,359)
$g.FillRectangle([System.Drawing.SolidBrush]::new($gold),78,430,82,5)
$copy='Comparte su historia, sus actividades y la información que ayude a otras personas a conocerla.'
$copyFormat=[System.Drawing.StringFormat]::new()
$copyFormat.Trimming=[System.Drawing.StringTrimming]::Word
$copyFormat.FormatFlags=[System.Drawing.StringFormatFlags]::LineLimit
$copyRect=[System.Drawing.RectangleF]::new(78,460,350,270)
$g.DrawString($copy,$fontBody,$bMuted,$copyRect,$copyFormat)

# Llamado a la acción.
$ctaRect=[System.Drawing.Rectangle]::new(78,760,350,150)
$g.FillRectangle($bPale,$ctaRect)
$g.DrawRectangle([System.Drawing.Pen]::new($teal,3),$ctaRect)
$g.DrawString('Inscribe tu iglesia',$fontCTA,$bTeal,99,793)
$g.DrawString('en koinoniapp.cl',$fontCTA,$bNavy,99,837)

# Captura del formulario para proponer una iglesia; se muestra sin datos personales.
$formPath=Join-Path $PSScriptRoot 'inscribe-church-form-reference.png'
$form=[System.Drawing.Bitmap]::new($formPath)
$formDest=[System.Drawing.Rectangle]::new(470,300,530,445)
$formSrc=[System.Drawing.Rectangle]::new(0,0,1000,840)
$g.FillRectangle($bWhite,$formDest)
$g.DrawImage($form,$formDest,$formSrc,[System.Drawing.GraphicsUnit]::Pixel)
$g.DrawRectangle($pBorder,$formDest)

# Pie de cierre, sin indicación de deslizar.
$g.DrawLine($pBorder,72,1240,1008,1240)
$g.DrawString('koinoniapp.cl',$fontFooter,$bNavy,78,1263)
$g.DrawString('Comparte tu iglesia con nuevas personas  →',$fontFooter,$bMuted,500,1263)

$outPath=Join-Path -Path $PSScriptRoot -ChildPath 'post-church-example-slide-09.png'
$canvas.Save($outPath,[System.Drawing.Imaging.ImageFormat]::Png)
$form.Dispose();$logo.Dispose();$copyFormat.Dispose();$canvas.Dispose();$g.Dispose()
Write-Output $outPath

