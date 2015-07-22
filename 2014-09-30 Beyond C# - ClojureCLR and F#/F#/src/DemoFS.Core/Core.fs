namespace DemoFS

module PredefinedDataTypes =
//Function
    let sum x y z =
        x + y + z
    let demoFunc() =
        let ret = sum 1 2 3
        let ret = (sum 1 2) 3
        let sumAbbrev = sum 1 2
        
        printfn "%A" (sumAbbrev 3)

    let printInfo printer x =
        printer x
    let demoPrintInfo() =
        let printer1 x = printfn "printing %A by printer 1" x
        let printer2 x = printfn "printing %A by printer 2" x

        let printInfo1 = printInfo printer1
        let printInfo2 = printInfo printer2

        printInfo1 3
        printInfo2 3

//Array
    let myArray = [| 0, 1, 2 |]
    let myExprArray = [| 0..2 |]
    let myFiniteArray = [| for i in 0..2 -> i * i |]
    let myInfiniteArray = 
        [|
            let i = ref 0
            while true do
                yield !i
                i := !i + 1
        |]//run out of memory
//List
    let myList = [ 0, 1, 2 ]
    let myExprList = [ 0..2 ]
    let myFiniteList = [ for i in 0..2 -> i * i ]
    let myInfiniteList = 
        [
            let i = ref 0
            while true do
                yield !i
                i := !i + 1
        ]//run out of memory
//Sequence
    let mySeq = 
        seq { 
            yield 0
            yield 1
            yield 2 
        }
    let myExprSeq = seq { 0..2 }
    let myFiniteSeq =
        seq { for i in 1..10 -> i * i }
    let myInfiniteSeq =
        seq {
            let i = ref 0 
            while true do 
                yield !i
                i := !i + 1
        }
//Tuple
    let tuple = 3, "", 4y
    let demoMyTuple() =
        let printXYZ(x, y, z) =
            printfn "%A" x
            printfn "%A" y
            printfn "%A" z
        printXYZ(tuple)

        let printXYZ (x, y, z) a b =
            printfn "%A" x
            printfn "%A" y
            printfn "%A" z
            printfn "%A" a
            printfn "%A" b
        printXYZ tuple (9, "9") 10