Add-Type -AssemblyName System.Drawing

$canvas=[System.Drawing.Bitmap]::new(1080,1920)
$g=[System.Drawing.Graphics]::FromImage($canvas)
$g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint=[System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$ivory=[System.Drawing.ColorTranslator]::FromHtml('#F5F6F2')
$navy=[System.Drawing.ColorTranslator]::FromHtml('#061A34')
$teal=[System.Drawing.ColorTranslator]::FromHtml('#0F6664')
$gold=[System.Drawing.ColorTranslator]::FromHtml('#C99A4A')
$muted=[System.Drawing.ColorTranslator]::FromHtml('#66727A')
$line=[System.Drawing.ColorTranslator]::FromHtml('#DDE1DC')
$pale=[System.Drawing.ColorTranslator]::FromHtml('#E8F1ED')
$white=[System.Drawing.Color]::White
$g.Clear($ivory)

$fontLabel=[System.Drawing.Font]::new('Segoe UI',25,[System.Drawing.FontStyle]::Bold)
$fontTitle=[System.Drawing.Font]::new('Georgia',66,[System.Drawing.FontStyle]::Regular)
$fontBody=[System.Drawing.Font]::new('Segoe UI',29,[System.Drawing.FontStyle]::Regular)
$fontStep=[System.Drawing.Font]::new('Georgia',42,[System.Drawing.FontStyle]::Regular)
$fontHead=[System.Drawing.Font]::new('Segoe UI',27,[System.Drawing.FontStyle]::Bold)
$fontSmall=[System.Drawing.Font]::new('Segoe UI',25,[System.Drawing.FontStyle]::Regular)
$fontBadge=[System.Drawing.Font]::new('Segoe UI',26,[System.Drawing.FontStyle]::Bold)
$fontButton=[System.Drawing.Font]::new('Segoe UI',25,[System.Drawing.FontStyle]::Bold)
$bNavy=[System.Drawing.SolidBrush]::new($navy)
$bTeal=[System.Drawing.SolidBrush]::new($teal)
$bGold=[System.Drawing.SolidBrush]::new($gold)
$bMuted=[System.Drawing.SolidBrush]::new($muted)
$bWhite=[System.Drawing.SolidBrush]::new($white)
$bPale=[System.Drawing.SolidBrush]::new($pale)
$pLine=[System.Drawing.Pen]::new($line,2)

$g.DrawString('INSCRIBE TU IGLESIA · 04',$fontLabel,$bTeal,88,70)
$g.FillRectangle($bGold,88,118,225,7)
$g.DrawString('Revisa y confirma',$fontTitle,$bNavy,82,160)
$g.DrawString('Antes de enviar, revisa los datos, declara tu',$fontBody,$bMuted,88,270)
$g.DrawString('autorización y confirma tu correo.',$fontBody,$bMuted,88,313)

# Two-step process in separate cards; illustrative sequence, not a fabricated app capture.
$card1=[System.Drawing.Rectangle]::new(88,405,904,220)
$g.FillRectangle($bWhite,$card1)
$g.DrawRectangle($pLine,$card1)
$g.DrawString('01',$fontStep,$bTeal,130,455)
$g.DrawString('Revisa la solicitud',$fontHead,$bNavy,250,463)
$g.DrawString('Comprueba que la información esté correcta',$fontSmall,$bMuted,250,520)
$g.DrawString('y declara que estás autorizado para enviarla.',$fontSmall,$bMuted,250,558)
$card2=[System.Drawing.Rectangle]::new(88,665,904,245)
$g.FillRectangle($bWhite,$card2)
$g.DrawRectangle($pLine,$card2)
$g.DrawString('02',$fontStep,$bTeal,130,710)
$g.DrawString('Confirma tu correo',$fontHead,$bNavy,250,718)
$g.DrawString('La confirmación permite dar seguimiento',$fontSmall,$bMuted,250,775)
$g.DrawString('al proceso; no valida por sí sola la autorización.',$fontSmall,$bMuted,250,813)

$callout=[System.Drawing.Rectangle]::new(88,990,904,270)
$g.FillRectangle($bPale,$callout)
$g.FillRectangle($bGold,88,990,8,270)
$g.DrawString('¿Qué pasa después?',$fontStep,$bNavy,126,1021)
$g.DrawString('El equipo revisará la solicitud. Guarda la referencia',$fontBody,$bMuted,126,1085)
$g.DrawString('recibida para consultar el avance.',$fontBody,$bMuted,126,1127)

$g.DrawLine($pLine,88,1320,992,1320)
$g.DrawString('Enviar no publica la iglesia ni concede acceso.',$fontBody,$bNavy,88,1352)
$g.FillRectangle($bTeal,770,1640,222,70)
$g.DrawString('Listo  ✓',$fontButton,$bWhite,807,1653)

$outPath=Join-Path $PSScriptRoot 'inscribe-slide-04.png'
$canvas.Save($outPath,[System.Drawing.Imaging.ImageFormat]::Png)
$canvas.Dispose();$g.Dispose()
Write-Output $outPath
