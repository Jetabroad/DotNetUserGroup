using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Policy;
using System.Text;
using System.Threading.Tasks;
using Bumblebee.Implementation;
using Bumblebee.Interfaces;
using Bumblebee.Setup;
using BumblebeeTests.Components;
using OpenQA.Selenium;

namespace BumblebeeTests.Pages
{
    class StandardPage : WebBlock,
        IHeaderComponent<StandardPage>,
        ISidebarComponent<StandardPage>
    {
        public StandardPage(Session session) : base(session)
        {
        }
    }
}
