------------------------------ MODULE DieHard ------------------------------
EXTENDS Integers

VARIABLES big, small

TypeOK == /\ big \in 0..5
          /\ small \in 0..3

Init == /\ big = 0
        /\ small = 0

Min(m,n) == IF m < n THEN m ELSE n

FillSmall == /\ small' = 3 
             /\ big' = big

FillBig == /\ big' = 5
           /\ small' = small

EmptySmall == /\ small' = 0
              /\ big' = big

EmptyBig == /\ big' = 0
            /\ small' = small
           
SmallToBig ==
    LET poured == Min(big + small, 5) - big
    IN /\ big' = big + poured
       /\ small' = small - poured

BigToSmall ==
    LET poured == Min(big+small, 3) - small
    IN /\ small' = small + poured
       /\ big' = big - poured

Next == \/ FillSmall
        \/ FillBig
        \/ EmptySmall
        \/ EmptyBig
        \/ SmallToBig
        \/ BigToSmall
(*
Spec == /\ TypeOK
        /\ big /= 4
 *)
=============================================================================
\* Modification History
\* Last modified Tue Oct 27 18:24:19 ICT 2015 by branck
\* Last modified Thu Oct 15 15:40:19 ICT 2015 by branck
\* Created Tue Jun 02 14:34:04 ICT 2015 by branck
