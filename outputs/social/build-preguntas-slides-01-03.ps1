Add-Type -AssemblyName System.Drawing

$outDir=$PSScriptRoot
$ivory=[System.Drawing.ColorTranslator]::FromHtml('#F5F6F2')
$navy=[System.Drawing.ColorTranslator]::FromHtml('#061A34')
$teal=[System.Drawing.ColorTranslator]::FromHtml('#0F6664')
$gold=[System.Drawing.ColorTranslator]::FromHtml('#C99A4A')
$muted=[System.Drawing.ColorTranslator]::FromHtml('#66727A')
$line=[System.Drawing.ColorTranslator]::FromHtml('#DDE1DC')
$white=[System.Drawing.Color]::White
$fontLabel=[System.Drawing.Font]::new('Segoe UI',25,[System.Drawing.FontStyle]::Bold)
$fontTitle=[System.Drawing.Font]::new('Georgia',60,[System.Drawing.FontStyle]::Regular)
$fontSection=[System.Drawing.Font]::new('Segoe UI',23,[System.Drawing.FontStyle]::Bold)
$fontBody=[System.Drawing.Font]::new('Segoe UI',34,[System.Drawing.FontStyle]::Regular)
$fontFooter=[System.Drawing.Font]::new('Segoe UI',26,[System.Drawing.FontStyle]::Regular)
$bNavy=[System.Drawing.SolidBrush]::new($navy)
$bTeal=[System.Drawing.SolidBrush]::new($teal)
$bGold=[System.Drawing.SolidBrush]::new($gold)
$bMuted=[System.Drawing.SolidBrush]::new($muted)
$bWhite=[System.Drawing.SolidBrush]::new($white)
$pLine=[System.Drawing.Pen]::new($line,2)
$fmt=[System.Drawing.StringFormat]::new()
$fmt.Trimming=[System.Drawing.StringTrimming]::Word
$fmt.FormatFlags=[System.Drawing.StringFormatFlags]::LineLimit

$slides=@(
    @{ file='preguntas-slide-01.png'; title=@('¿La información está','siempre actualizada?'); answer='Las iglesias pueden actualizar la información que comparten en Koinonia, pero algunos datos podrían cambiar con el tiempo. Antes de asistir, confirma directamente con la iglesia los horarios, actividades y otros detalles importantes para tu visita.' },
    @{ file='preguntas-slide-02.png'; title=@('¿Qué pasa después de','enviar una solicitud?'); answer='Después de enviar la solicitud y confirmar tu correo, el equipo revisará la información y la autorización declarada. Guarda la referencia recibida para consultar el avance. El envío no publica automáticamente la iglesia ni habilita accesos.' },
    @{ file='preguntas-slide-03.png'; title=@('¿Cómo puedo corregir o','actualizar la información','de mi iglesia?'); answer='La información de una iglesia se mantiene a través de su equipo con acceso de administración. Si tu iglesia necesita corregir o completar sus datos y aún no tiene acceso, comunícate con Koinonia para recibir orientación sobre cómo continuar.' }
)

for($i=0;$i -lt $slides.Count;$i++){
    $slide=$slides[$i]
    $canvas=[System.Drawing.Bitmap]::new(1080,1920)
    $g=[System.Drawing.Graphics]::FromImage($canvas)
    $g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint=[System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear($ivory)
    $g.DrawString('PREGUNTAS',$fontLabel,$bTeal,88,70)
    $g.FillRectangle($bGold,88,118,225,7)
    for($j=0;$j -lt $slide.title.Count;$j++){
        $g.DrawString($slide.title[$j],$fontTitle,$bNavy,82,(165+($j*70)))
    }
    $card=[System.Drawing.Rectangle]::new(88,440,904,770)
    $g.FillRectangle($bWhite,$card)
    $g.DrawRectangle($pLine,$card)
    $g.FillRectangle($bTeal,88,440,904,8)
    $g.DrawString('RESPUESTA',$fontSection,$bTeal,128,500)
    $bodyRect=[System.Drawing.RectangleF]::new(128,565,824,590)
    $g.DrawString($slide.answer,$fontBody,$bMuted,$bodyRect,$fmt)
    $g.DrawLine($pLine,88,1435,992,1435)
    $g.DrawString('koinoniapp.cl',$fontFooter,$bNavy,88,1470)
    $path=Join-Path $outDir $slide.file
    $canvas.Save($path,[System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose();$canvas.Dispose()
    Write-Output $path
}

$fmt.Dispose()
