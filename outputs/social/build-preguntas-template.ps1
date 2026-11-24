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
$fontSection=[System.Drawing.Font]::new('Segoe UI',23,[System.Drawing.FontStyle]::Bold)
$fontBody=[System.Drawing.Font]::new('Segoe UI',32,[System.Drawing.FontStyle]::Regular)
$fontFooter=[System.Drawing.Font]::new('Segoe UI',26,[System.Drawing.FontStyle]::Regular)
$fontButton=[System.Drawing.Font]::new('Segoe UI',25,[System.Drawing.FontStyle]::Bold)
$bNavy=[System.Drawing.SolidBrush]::new($navy)
$bTeal=[System.Drawing.SolidBrush]::new($teal)
$bGold=[System.Drawing.SolidBrush]::new($gold)
$bMuted=[System.Drawing.SolidBrush]::new($muted)
$bWhite=[System.Drawing.SolidBrush]::new($white)
$bPale=[System.Drawing.SolidBrush]::new($pale)
$pLine=[System.Drawing.Pen]::new($line,2)

# Shared layout: 88 px side margins, series label, question, answer card, closing prompt.
$g.DrawString('PREGUNTAS · 01 / 06',$fontLabel,$bTeal,88,70)
$g.FillRectangle($bGold,88,118,225,7)
$g.DrawString('¿Escribe aquí la',$fontTitle,$bNavy,82,170)
$g.DrawString('pregunta?',$fontTitle,$bNavy,82,245)

$card=[System.Drawing.Rectangle]::new(88,410,904,650)
$g.FillRectangle($bWhite,$card)
$g.DrawRectangle($pLine,$card)
$g.FillRectangle($bTeal,88,410,904,8)
$g.DrawString('RESPUESTA',$fontSection,$bTeal,128,470)
$g.DrawString('Redacta aquí una respuesta clara y',$fontBody,$bMuted,128,545)
$g.DrawString('cercana. Desarrolla la idea en frases',$fontBody,$bMuted,128,600)
$g.DrawString('breves, con espacio para leerla con',$fontBody,$bMuted,128,655)
$g.DrawString('facilidad en una historia.',$fontBody,$bMuted,128,710)

$callout=[System.Drawing.Rectangle]::new(88,1135,904,220)
$g.FillRectangle($bPale,$callout)
$g.FillRectangle($bGold,88,1135,8,220)
$g.DrawString('CIERRE O DATO CLAVE',$fontSection,$bTeal,126,1175)
$g.DrawString('Añade aquí una aclaración breve o',$fontBody,$bNavy,126,1235)
$g.DrawString('una invitación relacionada.',$fontBody,$bNavy,126,1280)

$g.DrawLine($pLine,88,1435,992,1435)
$g.DrawString('koinoniapp.cl',$fontFooter,$bNavy,88,1470)
$g.FillRectangle($bTeal,770,1640,222,70)
$g.DrawString('Desliza  →',$fontButton,$bWhite,793,1653)

$outPath=Join-Path $PSScriptRoot 'preguntas-template.png'
$canvas.Save($outPath,[System.Drawing.Imaging.ImageFormat]::Png)
$canvas.Dispose();$g.Dispose()
Write-Output $outPath
