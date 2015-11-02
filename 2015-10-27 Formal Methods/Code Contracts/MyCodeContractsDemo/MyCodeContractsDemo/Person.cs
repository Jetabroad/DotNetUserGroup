using System;
using System.Collections.Generic;
using System.Diagnostics.Contracts;
using System.Linq;
using System.Text;

namespace MyCodeContractsDemo
{
    class Person
    {
        public string Name { get; set; }
        [ContractInvariantMethod]
        private void Invariants()
        {
            Contract.Invariant(Name != null);
        }
        public override string ToString()
        {
            return Name;
        }
    }
}
