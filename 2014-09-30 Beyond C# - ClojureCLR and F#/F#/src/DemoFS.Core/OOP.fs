namespace DemoFS

type IMyData =
    abstract member Property1: int
    abstract member Property2: string
    abstract member Method1: int -> unit

type MyRecord = {
    Property1: int
    Property2: string
}
with
    interface IMyData with
        member this.Property1 = this.Property1
        member this.Property2 = this.Property2
        member this.Method1 (x: int) = printfn "%A" (this.Property1 + x)

[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module MyRecord =
    let doSomething1 x y = (x :> IMyData).Method1 y

