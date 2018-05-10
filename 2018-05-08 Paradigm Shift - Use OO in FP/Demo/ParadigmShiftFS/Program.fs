// Learn more about F# at http://fsharp.org

open System
open Microsoft.FSharp.Core.Operators.Unchecked

//begin data & behavior
type Rectangle = { Width: decimal; Height: decimal }

module Rectangle =
    let getRectanglePerimeter (rectangle: Rectangle) = (rectangle.Height + rectangle.Width) * 2m
//end data & behavior


[<EntryPoint>]
let main argv =
    //begin data & behavior
    let x = { Width = 5m; Height = 4m }
    let { Width = w; Height = h } = x

    printfn "%A" (w, h)
    //end data & behavior

    0 // return an integer exit code
