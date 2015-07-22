using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Bumblebee.Implementation;
using Bumblebee.Setup;
using BumblebeeTests.Components;

namespace BumblebeeTests.Pages
{
    class SupportPage : WebBlock,
        IHeaderComponent<HomePage>,
        ISidebarComponent<HomePage>
    {
        public const string Url = "http://docs.seleniumhq.org/support/";
        public SupportPage(Session session) : base(session)
        {
        }
    }
}
