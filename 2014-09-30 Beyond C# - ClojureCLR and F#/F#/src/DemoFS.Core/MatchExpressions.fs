namespace DemoFS

module MatchExpressions =
    let demoConstPM() =
        let x = 0

        match x with
        | 1 -> printfn "x is one"
        | 4 when x > 3 -> printfn "x is four"
        | _ -> printfn "x is something else"

    let demoIntPM() =
        let x = 0

        match x with
        | x when x > 6 -> printfn "x is in (6, infinity)"
        | x when x > 3 -> printfn "x is in (3, 6]"
        | _ -> printfn "x is something else"

    let demoListPM() =
        let x = [ 0..2 ]

        match x with
        | [ 1; 2; 3 ] -> printfn "123"
        | h :: t when h > 0 -> printfn "%A" t
        | (e & h) :: t when e > 4 -> printfn "%A" 0
        | [] -> printfn "empty list"
        | _ -> printfn "x is something else"

    //active pattern
    let (|Polar|) (x, y) = 
        let r = 
            x * x + y * y
            |> float
            |> sqrt
        let a = atan (y / x)

        r, a

    let demoPolarAP() =
        let p = (1.0 / (sqrt 2.0), 1.0 / (sqrt 2.0))

        match p with
        | Polar (1.0, a) when a = System.Math.PI / 6.0 -> printfn "30 degree"
        | Polar (1.0, a) when a = System.Math.PI / 4.0 -> printfn "45 degree"
        | Polar (1.0, a) when a = 2.0 * System.Math.PI / 6.0 -> printfn "60 degree"
        | _ -> printfn "unknown"

    let (|Even|Odd|) x = if x % 2 = 0 then Even else Odd
    let (|Even|_|) x =
        match x with
        | Even -> Some x
        | _ -> None
    let (|Odd|_|) x = 
        match x with 
        | Odd -> Some x 
        | _ -> None

    let demoEvenOddAP() =
        let x = 29

        match x with
        | Even 4 -> printfn "four"
        | Even _ -> printfn "An even number"
        | Odd 31 -> printfn "thirty one"
        | Odd _ -> printfn "An odd number"
        | _ -> printfn "unknown"

