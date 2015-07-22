namespace DemoFS

module Record =
    type MyRecord = {
        Property1: int
        Property2: string
        Property3: (int * string) []
    }
    let myRecord = {
        Property1 = 0
        Property2 = ""
        Property3 = [| (0, "") |]
    }
    let useMyData() =
        let myData1 = { myRecord with Property1 = 3 }
        let myData2 = { myRecord with Property2 = "my data" }
        let myData3 = { myRecord with Property3 = [| (3, "my data") |] }

        let x = myData1

        match x with
        | { Property1 = 0; Property2 = "my data"; Property3 = [||] } -> printfn "first case"
        | { Property1 = 3; Property2 = ""; Property3 = [||] } -> printfn "second case"
        | { Property1 = 3; Property2 = ""; Property3 = [| (3, "my data") |] } -> printfn "third case"
        | _ -> printfn "unknown"