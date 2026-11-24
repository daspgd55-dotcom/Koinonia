Add-Type -AssemblyName System.Drawing

$outDir=$PSScriptRoot
$size=1080
$teal=[System.Drawing.ColorTranslator]::FromHtml('#0F6664')
$navy=[System.Drawing.ColorTranslator]::FromHtml('#061A34')
$gold=[System.Drawing.ColorTranslator]::FromHtml('#C99A4A')
$ivory=[System.Drawing.ColorTranslator]::FromHtml('#F5F6F2')
$pale=[System.Drawing.ColorTranslator]::FromHtml('#E8F1ED')
$white=[System.Drawing.Color]::White

function New-Pen($color,[float]$width){
    $p=[System.Drawing.Pen]::new($color,$width)
    $p.StartCap=[System.Drawing.Drawing2D.LineCap]::Round
    $p.EndCap=[System.Drawing.Drawing2D.LineCap]::Round
    $p.LineJoin=[System.Drawing.Drawing2D.LineJoin]::Round
    return $p
}

function Draw-Community($g){
    $bTeal=[System.Drawing.SolidBrush]::new($teal);$bGold=[System.Drawing.SolidBrush]::new($gold)
    $pNavy=New-Pen $navy 34;$pTeal=New-Pen $teal 36
    $g.DrawArc($pNavy,420,390,240,255,195,150)
    $g.DrawArc($pTeal,230,470,250,250,198,140);$g.DrawArc($pTeal,600,470,250,250,202,140)
    $g.DrawArc($pNavy,300,555,480,335,205,130)
    $g.FillEllipse($bGold,476,278,128,128)
    $g.FillEllipse($bTeal,292,372,112,112);$g.FillEllipse($bTeal,676,372,112,112)
    $bTeal.Dispose();$bGold.Dispose();$pNavy.Dispose();$pTeal.Dispose()
}

function Draw-Explore($g){
    $pin=[System.Drawing.Drawing2D.GraphicsPath]::new()
    $pin.AddBezier(540,230,405,230,315,335,315,465)
    $pin.AddBezier(315,465,315,615,540,815,540,815)
    $pin.AddBezier(540,815,540,815,765,615,765,465)
    $pin.AddBezier(765,465,765,335,675,230,540,230)
    $pin.CloseFigure()
    $bPin=[System.Drawing.SolidBrush]::new($teal);$bIvory=[System.Drawing.SolidBrush]::new($ivory)
    $pGold=New-Pen $gold 20;$pNavy=New-Pen $navy 28
    $g.FillPath($bPin,$pin)
    $g.FillEllipse($bIvory,405,330,270,270)
    $g.DrawLine($pGold,540,375,540,445)
    $g.DrawLine($pNavy,440,495,540,425);$g.DrawLine($pNavy,540,425,640,495)
    $g.DrawLine($pNavy,460,488,460,565);$g.DrawLine($pNavy,620,488,620,565)
    $g.DrawLine($pNavy,460,565,620,565)
    $g.DrawRectangle($pGold,515,505,50,60)
    $pin.Dispose();$bPin.Dispose();$bIvory.Dispose();$pGold.Dispose();$pNavy.Dispose()
}

function Draw-Church($g){
    $pNavy=New-Pen $navy 34;$pTeal=New-Pen $teal 38;$pGold=New-Pen $gold 28
    $bPale=[System.Drawing.SolidBrush]::new($pale)
    $building=[System.Drawing.Rectangle]::new(300,410,480,330)
    $g.FillRectangle($bPale,$building)
    $g.DrawLine($pNavy,255,420,540,245);$g.DrawLine($pNavy,540,245,825,420)
    $g.DrawRectangle($pNavy,300,410,480,330)
    $g.DrawLine($pGold,540,290,540,370);$g.DrawLine($pGold,510,320,570,320)
    $g.DrawRectangle($pTeal,470,555,140,185)
    $g.DrawRectangle($pNavy,365,485,72,72);$g.DrawRectangle($pNavy,643,485,72,72)
    $g.DrawLine($pTeal,540,505,540,575);$g.DrawLine($pTeal,505,540,575,540)
    $pPlus=New-Pen $gold 30
    $g.DrawLine($pPlus,780,760,880,760);$g.DrawLine($pPlus,830,710,830,810)
    $pNavy.Dispose();$pTeal.Dispose();$pGold.Dispose();$pPlus.Dispose();$bPale.Dispose()
}

function Draw-Questions($g){
    $pTeal=New-Pen $teal 34;$pNavy=New-Pen $navy 30;$bTeal=[System.Drawing.SolidBrush]::new($teal)
    $bubble=[System.Drawing.Drawing2D.GraphicsPath]::new()
    $bubble.AddArc(300,300,430,350,180,180)
    $bubble.AddArc(300,300,430,350,0,180)
    $bubble.CloseFigure()
    $g.DrawPath($pTeal,$bubble)
    $g.DrawLine($pTeal,405,620,350,700);$g.DrawLine($pTeal,350,700,480,650)
    $fontQuestion=[System.Drawing.Font]::new('Georgia',260,[System.Drawing.FontStyle]::Bold)
    $g.DrawString('?', $fontQuestion,$bTeal,380,290)
    $bubble.Dispose();$pTeal.Dispose();$pNavy.Dispose();$bTeal.Dispose();$fontQuestion.Dispose()
}

$covers=@(
    @{file='cover-que-es-koinonia.png';draw='community'},
    @{file='cover-explora.png';draw='explore'},
    @{file='cover-inscribe-tu-iglesia.png';draw='church'},
    @{file='cover-preguntas.png';draw='questions'}
)
$bIvory=[System.Drawing.SolidBrush]::new($ivory)
$pOuter=New-Pen $teal 24;$pInner=New-Pen $gold 8
foreach($cover in $covers){
    $bmp=[System.Drawing.Bitmap]::new($size,$size,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g=[System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.TextRenderingHint=[System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.FillEllipse($bIvory,30,30,1020,1020)
    $g.DrawEllipse($pOuter,35,35,1010,1010)
    $g.DrawEllipse($pInner,62,62,956,956)
    switch($cover.draw){
        'community' { Draw-Community $g }
        'explore' { Draw-Explore $g }
        'church' { Draw-Church $g }
        'questions' { Draw-Questions $g }
    }
    $path=Join-Path $outDir $cover.file
    $bmp.Save($path,[System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose();$bmp.Dispose()
    Write-Output $path
}
$bIvory.Dispose();$pOuter.Dispose();$pInner.Dispose()
