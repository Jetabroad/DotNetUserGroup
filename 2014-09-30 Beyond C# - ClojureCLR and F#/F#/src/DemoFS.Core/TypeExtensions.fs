namespace DemoFS


type ExtendableType = {
    Property1: int
    Property2: string
}

module TypeExtensions =
    type ExtendableType with
        member this.Property3 = [| (this.Property1, this.Property2) |]
        static member StaticDoSomething (x: ExtendableType) = x.Property3 |> printfn "%A"

    let demoTypeExtensions() =
        let x = { Property1 = 3; Property2 = "3" }

        x.Property3 |> printfn "%A"
        ExtendableType.StaticDoSomething x

