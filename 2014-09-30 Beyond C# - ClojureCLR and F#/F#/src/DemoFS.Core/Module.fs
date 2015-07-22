namespace DemoFS

type Vector = { X: float; Y: float }

[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module Vector =
    let length v = sqrt (v.X * v.X + v.Y * v.Y)
    let inverse v = { X = -v.X; Y = -v.Y }
    let unit v = 
        let l = v |> length 
        { X = v.X / l; Y = v.Y / l }

module Demo =
    let demoModule() =
        let v = { X = 3.5; Y = 4.4 }
        
        v |> Vector.length |> printfn "%A"
        v |> Vector.inverse |> printfn "%A"
        v |> Vector.unit |> printfn "%A"



