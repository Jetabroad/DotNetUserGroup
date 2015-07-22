namespace DemoFS

open System.Threading

module ComputationExpressions = 
    let demoQueryExpression() =
        let x = [ 0..20 ] |> List.zip [ 10..30 ]
        let y = [ 15..35 ] |> List.zip [ 40..60 ]

        query {
            for (x1, x2) in x do
            join (y1, y2) in y on (x2 = y1)
            select y2
        }
        |> Seq.iter (printfn "%A")

    let demoAsynExpression() =
        let doSomethingAsync() =
            async {
                Thread.Sleep(10000)
                printfn "done doing something"
            }
        let returnSomethingAsync() = 
            async {
                Thread.Sleep(5000)
                return 200
            }

        async {
            do doSomethingAsync() |> Async.Start
            let! x = returnSomethingAsync() |> Async.StartChild

            return! x
        }
        |> Async.RunSynchronously
        |> printfn "%A"

    let demoAsyncParallel() =
        [ 0..20 ] 
        |> Seq.map (fun x -> 
            async {  
                Thread.Sleep(10000 - (x * 500))
                return x
            }) 
        |> Async.Parallel
        |> Async.RunSynchronously
        |> printfn "%A"

    type Maybe() =
        member this.Bind(x, f) =
            match x with
            | Some x -> f x
            | _ -> None

        member this.Delay f = f()
        member this.ReturnFrom x = Some x

    let maybe = new Maybe()

    let testMaybe() =
        maybe {
            let! a = Some 0
            let! b = Some 3
            let! c = Some 4

            return! a + b + c
        }
        |> printfn "%A"

    type Continuation() =
        member this.Bind(x, f) = fun c -> x (fun u -> f u c)
        member this.Return x = fun c -> c x

    let cont = new Continuation()
            
    let testContinuation() =
        let rec fib x =
            let rec fibC x =
//                match x with
//                | 0 -> fun c -> c(0)
//                | 1 -> fun c -> c(1)
//                | _ -> fun c -> 
//                    let m = fibC (x - 1)
//                    m (fun f1 -> 
//                        fibC (x - 2) (fun f2 -> c(f1 + f2)))
                cont {
                    match x with
                    | 0 -> return 0
                    | 1 -> return 1
                    | _ -> 
                        let! f1 = fibC (x - 1)
                        let! f2 = fibC (x - 2)
                        return f1 + f2
                }

            fibC x (fun x -> x)

        fib 1000 |> printfn "%A"