namespace DemoFS

module Operator =
    let demoPipelineAndCompose() =
        [ 0..10 ]
        |> List.map (fun x -> x * x)
        |> List.exists (fun x -> x % 7 = 0)
        |> not
        |> printfn "%A"

        [ 0..10 ]
        |> (List.map (fun x -> x * x) >> List.exists (fun x -> x % 7 = 0))
        |> not
        |> printfn "%A"

        [ 0..10 ]
        |> List.map (fun x -> x * x)
        |> (not << List.exists (fun x -> x % 7 = 0))
        |> printfn "%A"

        (not << List.exists (fun x -> x % 7 = 0))
        <| (
            [ 0..10 ] 
            |> List.map (fun x -> x * x)
        )
        |> printfn "%A"

    let (!) (r, i) = (r, -i)

    let (<|>) x y = 
        match (x, y) with 
        | (Some x, _) -> x 
        | (_, Some y) -> y 
        | _ -> failwith "Invalid Operation"

    let demoCustomOperator() =
        !(3, 5) |> printfn "%A"

        Some 3 <|> Some 4 |> printfn "%A"
        None <|> Some 4 |> printfn "%A"
//        None <|> None |> printfn "%A"

