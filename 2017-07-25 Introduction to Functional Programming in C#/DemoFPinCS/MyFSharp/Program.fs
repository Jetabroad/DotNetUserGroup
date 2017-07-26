// Learn more about F# at http://fsharp.org
// See the 'F# Tutorial' project for more help.

let fibs = Seq.unfold (fun (m,n) -> Some (m, (n,n+m))) (1I,1I)  

let rec ConvertToString list =
   match list with
   | [l] -> l.ToString()
   | head :: tail -> head.ToString() + " " + ConvertToString tail
   | [] -> ""

[<EntryPoint>]
let main argv = 
    let listString = Seq.take 500 fibs |> Seq.toList |> ConvertToString
    printfn "%A" listString
    0 // return an integer exit code
